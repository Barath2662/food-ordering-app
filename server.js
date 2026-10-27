const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const db = new sqlite3.Database(
    process.env.DB_PATH || path.join(__dirname, "food.db")
);

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS menu (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT NOT NULL,
            price REAL NOT NULL CHECK(price >= 0),
            available INTEGER NOT NULL DEFAULT 1
        )
    `);

    db.run(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            customer_name TEXT NOT NULL,
            dish_name TEXT NOT NULL,
            quantity INTEGER NOT NULL CHECK(quantity > 0),
            total REAL NOT NULL CHECK(total >= 0),
            status TEXT NOT NULL DEFAULT 'Pending'
        )
    `);

    db.get("SELECT COUNT(*) AS count FROM menu", (err, row) => {
        if (err) {
            console.error(err);
            return;
        }

        if (row.count === 0) {
            const stmt = db.prepare(`
                INSERT INTO menu (name, category, price, available)
                VALUES (?, ?, ?, ?)
            `);

            stmt.run("Veg Burger", "Fast Food", 120, 1);
            stmt.run("Pizza", "Italian", 250, 1);
            stmt.run("Fried Rice", "Chinese", 180, 1);

            stmt.finalize();
        }
    });
});

// Get all dishes
app.get("/api/menu", (req, res) => {
    db.all("SELECT * FROM menu ORDER BY id DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// Add a dish
app.post("/api/menu", (req, res) => {
    const { name, category, price, available = 1 } = req.body;

    if (
        typeof name !== "string" || !name.trim() ||
        typeof category !== "string" || !category.trim() ||
        !Number.isFinite(price) || price < 0 ||
        ![0, 1].includes(available)
    ) {
        return res.status(400).json({ error: "Invalid dish details" });
    }

    db.run(
        `INSERT INTO menu (name, category, price, available)
         VALUES (?, ?, ?, ?)`,
        [name.trim(), category.trim(), price, available],
        function (err) {
            if (err) return res.status(500).json({ error: "Insert failed" });

            res.status(201).json({
                id: this.lastID,
                name: name.trim(),
                category: category.trim(),
                price,
                available
            });
        }
    );
});

// Update a dish
app.put("/api/menu/:id", (req, res) => {
    const { name, category, price, available } = req.body;

    if (
        typeof name !== "string" || !name.trim() ||
        typeof category !== "string" || !category.trim() ||
        !Number.isFinite(price) || price < 0 ||
        ![0, 1].includes(available)
    ) {
        return res.status(400).json({ error: "Invalid dish details" });
    }

    db.run(
        `UPDATE menu
         SET name = ?, category = ?, price = ?, available = ?
         WHERE id = ?`,
        [name.trim(), category.trim(), price, available, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: "Update failed" });

            if (this.changes === 0) {
                return res.status(404).json({ error: "Dish not found" });
            }

            res.json({ message: "Dish updated successfully" });
        }
    );
});

// Delete a dish
app.delete("/api/menu/:id", (req, res) => {
    db.run(
        "DELETE FROM menu WHERE id = ?",
        [req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: "Delete failed" });

            if (this.changes === 0) {
                return res.status(404).json({ error: "Dish not found" });
            }

            res.json({ message: "Dish deleted successfully" });
        }
    );
});

// Get all customer orders
app.get("/api/orders", (req, res) => {
    db.all("SELECT * FROM orders ORDER BY id DESC", (err, rows) => {
        if (err) return res.status(500).json({ error: "Database error" });
        res.json(rows);
    });
});

// Create a customer order
app.post("/api/orders", (req, res) => {
    const { customer_name, dish_id, quantity } = req.body;

    if (
        typeof customer_name !== "string" ||
        !customer_name.trim() ||
        !Number.isInteger(dish_id) ||
        !Number.isInteger(quantity) ||
        quantity < 1 ||
        quantity > 100
    ) {
        return res.status(400).json({ error: "Invalid order details" });
    }

    db.get(
        "SELECT * FROM menu WHERE id = ? AND available = 1",
        [dish_id],
        (err, dish) => {
            if (err) return res.status(500).json({ error: "Database error" });
            if (!dish) {
                return res.status(404).json({ error: "Dish unavailable" });
            }

            const total = Number((dish.price * quantity).toFixed(2));

            db.run(
                `INSERT INTO orders
                 (customer_name, dish_name, quantity, total, status)
                 VALUES (?, ?, ?, ?, 'Pending')`,
                [customer_name.trim(), dish.name, quantity, total],
                function (insertErr) {
                    if (insertErr) {
                        return res.status(500).json({ error: "Order creation failed" });
                    }

                    res.status(201).json({
                        id: this.lastID,
                        customer_name: customer_name.trim(),
                        dish_name: dish.name,
                        quantity,
                        total,
                        status: "Pending"
                    });
                }
            );
        }
    );
});

// Update an order's status
app.patch("/api/orders/:id", (req, res) => {
    const allowedStatuses = [
        "Pending",
        "Preparing",
        "Delivered",
        "Cancelled"
    ];

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ error: "Invalid order status" });
    }

    db.run(
        "UPDATE orders SET status = ? WHERE id = ?",
        [status, req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: "Update failed" });

            if (this.changes === 0) {
                return res.status(404).json({ error: "Order not found" });
            }

            res.json({ message: "Order status updated successfully" });
        }
    );
});

// Delete an order
app.delete("/api/orders/:id", (req, res) => {
    db.run(
        "DELETE FROM orders WHERE id = ?",
        [req.params.id],
        function (err) {
            if (err) return res.status(500).json({ error: "Delete failed" });

            if (this.changes === 0) {
                return res.status(404).json({ error: "Order not found" });
            }

            res.json({ message: "Order deleted successfully" });
        }
    );
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Food ordering application running on port ${PORT}`);
});