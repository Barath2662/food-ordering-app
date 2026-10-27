const menuList = document.getElementById("menuList");
const ordersList = document.getElementById("ordersList");
const dishForm = document.getElementById("dishForm");
const orderForm = document.getElementById("orderForm");

async function api(url, options = {}) {
    const response = await fetch(url, {
        ...options,
        headers: {
            "Content-Type": "application/json",
            ...options.headers
        }
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || "Request failed");
    }

    return data;
}

function escapeHTML(value) {
    return String(value).replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    })[char]);
}

async function loadMenu() {
    try {
        const dishes = await api("/api/menu");

        menuList.innerHTML = "";
        const orderDish = document.getElementById("orderDish");

        orderDish.innerHTML = "";

        dishes.forEach(dish => {
            const item = document.createElement("div");
            item.className = "item";

            item.innerHTML = `
                <div>
                    <strong>${escapeHTML(dish.name)}</strong>
                    <p>${escapeHTML(dish.category)} -
                       ₹${Number(dish.price).toFixed(2)}</p>
                    <p>${dish.available ? "Available" : "Unavailable"}</p>
                </div>

                <div>
                    <button data-action="edit" data-id="${dish.id}">
                        Edit
                    </button>
                    <button data-action="delete" data-id="${dish.id}">
                        Delete
                    </button>
                </div>
            `;

            menuList.appendChild(item);

            if (dish.available) {
                const option = document.createElement("option");
                option.value = dish.id;
                option.textContent =
                    `${dish.name} - ₹${Number(dish.price).toFixed(2)}`;

                orderDish.appendChild(option);
            }
        });

        if (orderDish.options.length === 0) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "No dishes available";
            orderDish.appendChild(option);
        }
    } catch (error) {
        alert(error.message);
    }
}

dishForm.addEventListener("submit", async event => {
    event.preventDefault();

    const id = document.getElementById("dishId").value;

    const dish = {
        name: document.getElementById("dishName").value.trim(),
        category: document.getElementById("category").value.trim(),
        price: Number(document.getElementById("price").value),
        available: Number(document.getElementById("available").value)
    };

    try {
        await api(id ? `/api/menu/${id}` : "/api/menu", {
            method: id ? "PUT" : "POST",
            body: JSON.stringify(dish)
        });

        dishForm.reset();
        document.getElementById("dishId").value = "";

        await loadMenu();
        alert("Dish saved successfully");
    } catch (error) {
        alert(error.message);
    }
});

document.getElementById("cancelEdit").addEventListener("click", () => {
    dishForm.reset();
    document.getElementById("dishId").value = "";
});

menuList.addEventListener("click", async event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const id = button.dataset.id;
    const action = button.dataset.action;

    try {
        if (action === "edit") {
            const dishes = await api("/api/menu");
            const dish = dishes.find(item => item.id === Number(id));

            if (!dish) throw new Error("Dish not found");

            document.getElementById("dishId").value = dish.id;
            document.getElementById("dishName").value = dish.name;
            document.getElementById("category").value = dish.category;
            document.getElementById("price").value = dish.price;
            document.getElementById("available").value = dish.available;

            document.getElementById("dishName").focus();
        }

        if (action === "delete") {
            if (!confirm("Delete this dish?")) return;

            await api(`/api/menu/${id}`, {
                method: "DELETE"
            });

            await loadMenu();
            alert("Dish deleted successfully");
        }
    } catch (error) {
        alert(error.message);
    }
});

orderForm.addEventListener("submit", async event => {
    event.preventDefault();

    const order = {
        customer_name: document.getElementById("customerName").value.trim(),
        dish_id: Number(document.getElementById("orderDish").value),
        quantity: Number(document.getElementById("quantity").value)
    };

    if (!order.dish_id) {
        alert("Please select an available dish");
        return;
    }

    try {
        await api("/api/orders", {
            method: "POST",
            body: JSON.stringify(order)
        });

        orderForm.reset();

        await loadOrders();
        alert("Order placed successfully");
    } catch (error) {
        alert(error.message);
    }
});

async function loadOrders() {
    try {
        const orders = await api("/api/orders");

        ordersList.innerHTML = "";

        orders.forEach(order => {
            const item = document.createElement("div");
            item.className = "item";

            const statusSelect = document.createElement("select");

            ["Pending", "Preparing", "Delivered", "Cancelled"]
                .forEach(status => {
                    const option = document.createElement("option");
                    option.value = status;
                    option.textContent = status;
                    option.selected = order.status === status;
                    statusSelect.appendChild(option);
                });

            statusSelect.addEventListener("change", async () => {
                try {
                    await api(`/api/orders/${order.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                            status: statusSelect.value
                        })
                    });

                    await loadOrders();
                } catch (error) {
                    alert(error.message);
                    await loadOrders();
                }
            });

            const details = document.createElement("div");

            details.textContent =
                `Order #${order.id}: ${order.customer_name} - ` +
                `${order.dish_name} x ${order.quantity} - ` +
                `₹${Number(order.total).toFixed(2)} - `;

            item.appendChild(details);
            item.appendChild(statusSelect);

            const deleteButton = document.createElement("button");
            deleteButton.textContent = "Delete Order";

            deleteButton.addEventListener("click", async () => {
                if (!confirm("Delete this order?")) return;

                try {
                    await api(`/api/orders/${order.id}`, {
                        method: "DELETE"
                    });

                    await loadOrders();
                } catch (error) {
                    alert(error.message);
                }
            });

            item.appendChild(deleteButton);
            ordersList.appendChild(item);
        });
    } catch (error) {
        alert(error.message);
    }
}

loadMenu();
loadOrders();