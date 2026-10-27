
require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

const Food = require("./models/Food");
const Order = require("./models/Order");

const app = express();

app.use(express.json({ limit: "100kb" }));
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

// Database connection
async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });

  console.log("Connected to MongoDB Atlas");
}

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    database: mongoose.connection.readyState === 1
      ? "Connected"
      : "Disconnected"
  });
});

// ================= FOOD CRUD =================

// Display all food items
app.get("/api/foods", async (req, res) => {
  try {
    const foods = await Food.find().sort({ createdAt: -1 });
    res.json(foods);
  } catch (error) {
    console.error("Fetch foods error:", error);
    res.status(500).json({ error: "Failed to fetch food items" });
  }
});

// Get a single food item
app.get("/api/foods/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid food ID" });
    }

    const food = await Food.findById(req.params.id);

    if (!food) {
      return res.status(404).json({ error: "Food item not found" });
    }

    res.json(food);
  } catch (error) {
    console.error("Get food error:", error);
    res.status(500).json({ error: "Failed to fetch food item" });
  }
});

// Add a new dish
app.post("/api/foods", async (req, res) => {
  try {
    const { name, description, category, price, image, available } = req.body;

    if (
      typeof name !== "string" ||
      !name.trim() ||
      typeof category !== "string" ||
      !category.trim() ||
      price === undefined ||
      price === null ||
      price === "" ||
      !Number.isFinite(Number(price)) ||
      Number(price) < 0
    ) {
      return res.status(400).json({
        error: "Valid name, category and non-negative price are required"
      });
    }

    const food = await Food.create({
      name: name.trim(),
      description,
      category: category.trim(),
      price: Number(price),
      image,
      available: available === undefined ? true : available
    });

    res.status(201).json(food);
  } catch (error) {
    console.error("Create food error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to add food item" });
  }
});

// Update food details
app.put("/api/foods/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid food ID" });
    }

    const allowedFields = [
      "name",
      "description",
      "category",
      "price",
      "image",
      "available"
    ];

    const updates = {};

    for (const field of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        updates[field] = req.body[field];
      }
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No valid fields provided" });
    }

    if ("name" in updates &&
        (typeof updates.name !== "string" || !updates.name.trim())) {
      return res.status(400).json({ error: "Name cannot be empty" });
    }

    if ("category" in updates &&
        (typeof updates.category !== "string" || !updates.category.trim())) {
      return res.status(400).json({ error: "Category cannot be empty" });
    }

    if ("price" in updates &&
        (!Number.isFinite(Number(updates.price)) ||
         updates.price === "" ||
         Number(updates.price) < 0)) {
      return res.status(400).json({ error: "Price must be non-negative" });
    }

    if ("price" in updates) {
      updates.price = Number(updates.price);
    }

    if ("name" in updates) updates.name = updates.name.trim();
    if ("category" in updates) updates.category = updates.category.trim();

    const food = await Food.findByIdAndUpdate(
      req.params.id,
      updates,
      {
        new: true,
        runValidators: true
      }
    );

    if (!food) {
      return res.status(404).json({ error: "Food item not found" });
    }

    res.json(food);
  } catch (error) {
    console.error("Update food error:", error);

    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to update food item" });
  }
});

// Delete a dish
app.delete("/api/foods/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid food ID" });
    }

    const food = await Food.findByIdAndDelete(req.params.id);

    if (!food) {
      return res.status(404).json({ error: "Food item not found" });
    }

    res.json({ message: "Food item deleted successfully" });
  } catch (error) {
    console.error("Delete food error:", error);
    res.status(500).json({ error: "Failed to delete food item" });
  }
});

// ================= CUSTOMER ORDERS =================

// Display all orders
app.get("/api/orders", async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error("Fetch orders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
});

// Create a customer order
app.post("/api/orders", async (req, res) => {
  try {
    const { customerName, phone, address, items } = req.body;

    if (
      typeof customerName !== "string" ||
      !customerName.trim() ||
      typeof phone !== "string" ||
      !phone.trim() ||
      typeof address !== "string" ||
      !address.trim() ||
      !Array.isArray(items) ||
      items.length === 0
    ) {
      return res.status(400).json({
        error: "Customer name, phone, address and order items are required"
      });
    }

    if (items.length > 50) {
      return res.status(400).json({ error: "Too many items in one order" });
    }

    const quantities = new Map();

    for (const item of items) {
      if (
        !item ||
        !mongoose.isValidObjectId(item.foodId) ||
        !Number.isSafeInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > 100
      ) {
        return res.status(400).json({
          error: "Each item needs a valid foodId and quantity between 1 and 100"
        });
      }

      const key = item.foodId.toString();
      quantities.set(key, (quantities.get(key) || 0) + item.quantity);
    }

    const foodIds = [...quantities.keys()];
    const foods = await Food.find({
      _id: { $in: foodIds },
      available: true
    });

    if (foods.length !== foodIds.length) {
      return res.status(400).json({
        error: "One or more food items are unavailable or do not exist"
      });
    }

    const foodMap = new Map(foods.map(food => [food._id.toString(), food]));

    const orderItems = foodIds.map(foodId => {
      const food = foodMap.get(foodId);

      return {
        foodId: food._id,
        name: food.name,
        price: food.price,
        quantity: quantities.get(foodId)
      };
    });

    const totalAmount = orderItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    const order = await Order.create({
      customerName: customerName.trim(),
      phone: phone.trim(),
      address: address.trim(),
      items: orderItems,
      totalAmount
    });

    res.status(201).json(order);
  } catch (error) {
    console.error("Create order error:", error);

    if (error.name === "ValidationError") {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: "Failed to create order" });
  }
});

// Update order status
app.patch("/api/orders/:id/status", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const allowedStatuses = [
      "Pending",
      "Preparing",
      "Out for Delivery",
      "Delivered",
      "Cancelled"
    ];

    const { status } = req.body;

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid order status" });
    }

    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json(order);
  } catch (error) {
    console.error("Update order error:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
});

// Delete an order
app.delete("/api/orders/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: "Invalid order ID" });
    }

    const order = await Order.findByIdAndDelete(req.params.id);

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    res.json({ message: "Order deleted successfully" });
  } catch (error) {
    console.error("Delete order error:", error);
    res.status(500).json({ error: "Failed to delete order" });
  }
});

// Start server only after database connection succeeds
async function startServer() {
  try {
    await connectDatabase();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Food Ordering App running on port ${PORT}`);
    });
  } catch (error) {
    console.error("Failed to start application:", error.message);
    process.exit(1);
  }
}

async function connectDatabase() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI environment variable is missing");
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    serverSelectionTimeoutMS: 10000
  });

  console.log("Connected to MongoDB Atlas");
}

startServer();
