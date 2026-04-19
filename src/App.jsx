import { useState, useEffect } from "react";

export default function App() {
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Food");
  const [expenses, setExpenses] = useState([]);

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
      date: new Date().toLocaleDateString(),
    };

    setExpenses([newExpense, ...expenses]);
    setAmount("");
  };

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "auto" }}>
      <h2 style={{ textAlign: "center" }}>💸 Expense Tracker</h2>

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
      </select>

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
        Add Expense
      </button>

      <h3 style={{ marginTop: 20 }}>Total: ₹{total}</h3>

      <ul style={{ listStyle: "none", padding: 0 }}>
        {expenses.map((e, i) => (
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
          </li>
        ))}
      </ul>
    </div>
  );
}