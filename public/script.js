
const foodForm = document.getElementById("foodForm");
const foodList = document.getElementById("foodList");
const orderForm = document.getElementById("orderForm");
const orderFood = document.getElementById("orderFood");
const orderList = document.getElementById("orderList");

let foods = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers
    }
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Request failed (${response.status})`);
  }

  return data;
}

function showMessage(id, message, success = true) {
  const element = document.getElementById(id);
  element.textContent = message;
  element.className = success ? "message-success" : "message-error";
}

function makeElement(tag, text, className) {
  const element = document.createElement(tag);
  element.textContent = text;

  if (className) {
    element.className = className;
  }

  return element;
}

async function checkConnection() {
  const status = document.getElementById("connectionStatus");

  try {
    const result = await api("/api/health");
    status.textContent = `Application: ${result.status} | Database: ${result.database}`;
  } catch {
    status.textContent = "Unable to check database connection";
  }
}

async function loadFoods() {
  try {
    foods = await api("/api/foods");
    renderFoods();
    renderFoodOptions();
  } catch (error) {
    foodList.textContent = error.message;
  }
}

function renderFoods() {
  foodList.replaceChildren();

  if (foods.length === 0) {
    foodList.textContent = "No food items yet. Add your first dish above.";
    return;
  }

  foods.forEach(food => {
    const card = makeElement("article", "", "food-item");

    if (food.image) {
      const image = document.createElement("img");
      image.src = food.image;
      image.alt = food.name;
      image.loading = "lazy";
      image.referrerPolicy = "no-referrer";
      image.addEventListener("error", () => image.remove());
      card.appendChild(image);
    }

    card.appendChild(makeElement("h3", food.name));
    card.appendChild(makeElement("p", food.description || "No description"));
    card.appendChild(makeElement("p", `Category: ${food.category}`));
    card.appendChild(makeElement("p", `Price: ₹${Number(food.price).toFixed(2)}`));
    card.appendChild(
      makeElement("p", food.available ? "Available" : "Unavailable")
    );

    const editButton = makeElement("button", "Edit");
    editButton.type = "button";
    editButton.addEventListener("click", () => editFood(food));

    const deleteButton = makeElement("button", "Delete", "danger");
    deleteButton.type = "button";
    deleteButton.addEventListener("click", () => deleteFood(food._id));

    card.append(editButton, deleteButton);
    foodList.appendChild(card);
  });
}

function renderFoodOptions() {
  const previousValue = orderFood.value;
  orderFood.replaceChildren();

  const placeholder = makeElement("option", "Select food");
  placeholder.value = "";
  orderFood.appendChild(placeholder);

  foods.filter(food => food.available).forEach(food => {
    const option = makeElement(
      "option",
      `${food.name} — ₹${Number(food.price).toFixed(2)}`
    );

    option.value = food._id;
    orderFood.appendChild(option);
  });

  if (foods.some(food => food._id === previousValue && food.available)) {
    orderFood.value = previousValue;
  }
}

foodForm.addEventListener("submit", async event => {
  event.preventDefault();

  const id = document.getElementById("foodId").value;

  const food = {
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value.trim(),
    price: Number(document.getElementById("price").value),
    description: document.getElementById("description").value.trim(),
    image: document.getElementById("image").value.trim(),
    available: document.getElementById("available").checked
  };

  try {
    await api(id ? `/api/foods/${id}` : "/api/foods", {
      method: id ? "PUT" : "POST",
      body: JSON.stringify(food)
    });

    foodForm.reset();
    document.getElementById("foodId").value = "";
    document.getElementById("formTitle").textContent = "Add Food Item";
    document.getElementById("saveButton").textContent = "Add Food";
    document.getElementById("cancelEdit").hidden = true;
    document.getElementById("available").checked = true;

    showMessage("foodMessage", id ? "Food updated successfully" : "Food added successfully");
    await loadFoods();
  } catch (error) {
    showMessage("foodMessage", error.message, false);
  }
});

function editFood(food) {
  document.getElementById("foodId").value = food._id;
  document.getElementById("name").value = food.name;
  document.getElementById("category").value = food.category;
  document.getElementById("price").value = food.price;
  document.getElementById("description").value = food.description || "";
  document.getElementById("image").value = food.image || "";
  document.getElementById("available").checked = food.available;

  document.getElementById("formTitle").textContent = "Update Food Item";
  document.getElementById("saveButton").textContent = "Update Food";
  document.getElementById("cancelEdit").hidden = false;

  foodForm.scrollIntoView({ behavior: "smooth" });
}

document.getElementById("cancelEdit").addEventListener("click", () => {
  foodForm.reset();
  document.getElementById("foodId").value = "";
  document.getElementById("formTitle").textContent = "Add Food Item";
  document.getElementById("saveButton").textContent = "Add Food";
  document.getElementById("cancelEdit").hidden = true;
  document.getElementById("available").checked = true;
});

async function deleteFood(id) {
  if (!confirm("Delete this food item?")) {
    return;
  }

  try {
    await api(`/api/foods/${id}`, { method: "DELETE" });
    showMessage("foodMessage", "Food item deleted successfully");
    await loadFoods();
  } catch (error) {
    showMessage("foodMessage", error.message, false);
  }
}

orderForm.addEventListener("submit", async event => {
  event.preventDefault();

  const item = {
    foodId: orderFood.value,
    quantity: Number(document.getElementById("quantity").value)
  };

  try {
    const order = await api("/api/orders", {
      method: "POST",
      body: JSON.stringify({
        customerName: document.getElementById("customerName").value.trim(),
        phone: document.getElementById("phone").value.trim(),
        address: document.getElementById("address").value.trim(),
        items: [item]
      })
    });

    orderForm.reset();
    document.getElementById("quantity").value = 1;

    showMessage(
      "orderMessage",
      `Order placed successfully. Order ID: ${order._id}`
    );

    await loadOrders();
  } catch (error) {
    showMessage("orderMessage", error.message, false);
  }
});

async function loadOrders() {
  try {
    const orders = await api("/api/orders");
    orderList.replaceChildren();

    if (orders.length === 0) {
      orderList.textContent = "No customer orders yet.";
      return;
    }

    orders.forEach(order => {
      const card = makeElement("article", "", "order-item");

      card.appendChild(makeElement("h3", `Order ${order._id}`));
      card.appendChild(makeElement("p", `Customer: ${order.customerName}`));
      card.appendChild(makeElement("p", `Phone: ${order.phone}`));
      card.appendChild(makeElement("p", `Address: ${order.address}`));
      card.appendChild(makeElement("p", `Total: ₹${Number(order.totalAmount).toFixed(2)}`));
      card.appendChild(makeElement("p", `Items: ${order.items.map(item => `${item.name} × ${item.quantity}`).join(", ")}`));
      card.appendChild(makeElement("p", `Status: ${order.status}`, "status"));

      const statusSelect = document.createElement("select");

      [
        "Pending",
        "Preparing",
        "Out for Delivery",
        "Delivered",
        "Cancelled"
      ].forEach(status => {
        const option = makeElement("option", status);
        option.value = status;
        option.selected = status === order.status;
        statusSelect.appendChild(option);
      });

      const updateButton = makeElement("button", "Update Status");
      updateButton.type = "button";
      updateButton.addEventListener("click", async () => {
        try {
          await api(`/api/orders/${order._id}/status`, {
            method: "PATCH",
            body: JSON.stringify({ status: statusSelect.value })
          });

          await loadOrders();
        } catch (error) {
          alert(error.message);
        }
      });

      const deleteButton = makeElement("button", "Delete Order", "danger");
      deleteButton.type = "button";
      deleteButton.addEventListener("click", async () => {
        if (!confirm("Delete this order?")) return;

        try {
          await api(`/api/orders/${order._id}`, { method: "DELETE" });
          await loadOrders();
        } catch (error) {
          alert(error.message);
        }
      });

      card.append(statusSelect, updateButton, deleteButton);
      orderList.appendChild(card);
    });
  } catch (error) {
    orderList.textContent = error.message;
  }
}

async function initialize() {
  await checkConnection();
  await loadFoods();
  await loadOrders();
}

initialize();
