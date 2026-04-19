import { useState, useEffect } from "react";

export default function App() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [date, setDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [expenses, setExpenses] = useState([]);
  const [filter, setFilter] = useState("month");

  useEffect(() => {
    const saved = JSON.parse(localStorage.getItem("expenses")) || [];
    setExpenses(saved);
  }, []);

  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  const addExpense = () => {
    if (!amount) return;

    const newExpense = {
      amount: parseFloat(amount),
      category,
      date,
    };

    setExpenses([newExpense, ...expenses]);
    setAmount("");
  };

  const deleteExpense = (index) => {
    const updated = expenses.filter((_, i) => i !== index);
    setExpenses(updated);
  };

  const editExpense = (index) => {
    const item = expenses[index];
    setAmount(item.amount);
    setCategory(item.category);
    setDate(item.date);

    deleteExpense(index);
  };

  // Filter logic
  const now = new Date();
  const filteredExpenses = expenses.filter((e) => {
    const d = new Date(e.date);

    if (filter === "today") {
      return d.toDateString() === now.toDateString();
    }

    return (
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear()
    );
  });

  const total = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);

  // Category totals
  const categoryTotals = {};
  filteredExpenses.forEach((e) => {
    categoryTotals[e.category] =
      (categoryTotals[e.category] || 0) + e.amount;
  });

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "auto" }}>
      <h2 style={{ textAlign: "center" }}>💸 My Expense Tracker</h2>

      {/* Input */}
      <input
        type="number"
        placeholder="Enter amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <select
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      >
        <option>Food</option>
        <option>Travel</option>
        <option>Shopping</option>
        <option>Bills</option>
        <option>Fuel</option>
        <option>EMI</option>
        <option>Rent</option>
        <option>Entertainment</option>
      </select>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10 }}
      />

      <button
        onClick={addExpense}
        style={{
          width: "100%",
          padding: 12,
          background: "#4CAF50",
          color: "white",
          border: "none",
          borderRadius: 5,
        }}
      >
        Add / Update Expense
      </button>

      {/* Filter Toggle */}
      <div style={{ marginTop: 15, textAlign: "center" }}>
        <button onClick={() => setFilter("today")}>Today</button>
        <button onClick={() => setFilter("month")} style={{ marginLeft: 10 }}>
          This Month
        </button>
      </div>

      <h3 style={{ marginTop: 15 }}>Total: ₹{total}</h3>

      {/* Category Breakdown */}
      <div style={{ marginBottom: 15 }}>
        {Object.keys(categoryTotals).map((cat) => (
          <div key={cat}>
            {cat}: ₹{categoryTotals[cat]}
          </div>
        ))}
      </div>

      {/* Expense List */}
      <ul style={{ listStyle: "none", padding: 0 }}>
        {filteredExpenses.map((e, i) => (
          <li
            key={i}
            style={{
              padding: 10,
              marginBottom: 8,
              background: "#f5f5f5",
              borderRadius: 5,
            }}
          >
            ₹{e.amount} - {e.category} <br />
            <small>{e.date}</small>

            <div style={{ marginTop: 5 }}>
              <button onClick={() => editExpense(i)}>Edit</button>
              <button
                onClick={() => deleteExpense(i)}
                style={{ marginLeft: 10, color: "red" }}
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}