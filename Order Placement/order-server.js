const express = require('express');
const pg = require('pg');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const { Pool } = pg;

const dbConfigPostgreSQL = {
    user: 'postgres',
    host: 'localhost',
    database: 'orders',
    password: 'root',
    port: 5432,
};

const db = new Pool(dbConfigPostgreSQL);

db.connect()
    .then(() => {
        console.log('Connected to PostgreSQL database');
    })
    .catch((err) => {
        console.error('Error connecting to PostgreSQL database:', err);
    });

app.get('/orders/all', (req, res) => {
    const sql = 'SELECT * FROM orders';
    db.query(sql, (err, result) => {
        if (err) return res.status(500).json({ message: 'Error inside server...' });
        const rows = result.rows;
        return res.json(rows);
    });
});

app.get('/orders/read/:orderID', (req, res) => {
    const sql = 'SELECT * FROM orders WHERE "orderID" = $1';
    const id = req.params.orderID;
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error inside server...' + err });
        return res.json(result.rows[0]);
    });
});

app.delete('/orders/delete/:orderID', (req, res) => {
    const sql = 'DELETE FROM orders WHERE "orderID" = $1';
    const id = req.params.orderID;
    db.query(sql, [id], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error inside server...' + err });
        return res.json(result.rows[0]);
    });
});

app.put('/orders/update/:orderID', (req, res) => {
    const sql = 'UPDATE orders SET quantity=$1, cost=$2 WHERE "orderID" = $3';
    const orderID = req.params.orderID;
    const { quantity, cost } = req.body;
    db.query(sql, [quantity, cost, orderID], (err, result) => {
        if (err) return res.status(500).json({ message: 'Error inside server...' + err });
        return res.json(result);
    });
});

app.post('/orders/add', async (req, res) => {
    const userID = req.body.userID;
    const productID = req.body.productID;
    const quantity = req.body.quantity;

    try {
        const userExistsResponse = await fetch(`http://localhost:7000/users/check/${userID}`);
        const userExists = await userExistsResponse.json();

        if (!userExists) {
            return res.status(400).json({ success: false, message: 'User does not exist' });
        }

        const purchaseResponse = await fetch(`http://localhost:9000/inventory/purchase`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                "productID": productID,
                "quantity": quantity,
            }),
        });

        const purchaseResult = await purchaseResponse.json();

        if (purchaseResult.success) {
            const cost = purchaseResult.cost;

            const maxIdQuery = 'SELECT MAX("orderID") AS maxId FROM orders';

            db.query(maxIdQuery, (err, result) => {
                if (err) return res.status(500).json(err);

                let nextId = 1;
                if (result?.rows?.[0]?.maxid) {
                    const maxId = result.rows[0].maxid;
                    const numericPart = parseInt(maxId.substring(1));
                    nextId = numericPart + 1;
                }

                const newOrderID = 'O' + nextId;

                const sql = 'INSERT INTO orders ("orderID", "userID", "productID", "quantity", "cost", "date") VALUES ($1, $2, $3, $4, $5, NOW())';
                const values = [newOrderID, userID, productID, quantity, cost];

                db.query(sql, values, (err, result) => {
                    if (err) return res.status(500).json(err);
                    return res.json(purchaseResult);
                });
            });
        } else {
            return res.status(400).json(purchaseResult);
        }
    } catch (error) {
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

app.listen(8000, () => {
    console.log('Order Placement is listening on port 8000');
});
