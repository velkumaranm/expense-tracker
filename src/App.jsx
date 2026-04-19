import { useState, useEffect } from "react";
import { auth, db } from "./firebase";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
} from "firebase/auth";
import {
  collection,
  addDoc,
  onSnapshot,
  deleteDoc,
  doc,
  updateDoc,
} from "firebase/firestore";

import {
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function App() {
  const [user, setUser] = useState(null);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [amount, setAmount] = useState("");
  const [type, setType] = useState("expense"); // NEW
  const [category, setCategory] = useState("Food");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

  const [expenses, setExpenses] = useState([]);
  const [editId, setEditId] = useState(null);

  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");

  const [budget, setBudget] = useState(localStorage.getItem("budget") || "");

  useEffect(() => {
    localStorage.setItem("budget", budget);
  }, [budget]);

  useEffect(() => {
    return auth.onAuthStateChanged(setUser);
  }, []);

  useEffect(() => {
    if (!user) return;

    return onSnapshot(
      collection(db, "users", user.uid, "expenses"),
      (snap) => {
        setExpenses(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      }
    );
  }, [user]);

  const login = () => signInWithEmailAndPassword(auth, email, password);
  const signup = () => createUserWithEmailAndPassword(auth, email, password);
  const googleLogin = () =>
    signInWithPopup(auth, new GoogleAuthProvider());
  const logout = () => signOut(auth);

  const addExpense = async () => {
    if (!amount) return;

    const data = {
      amount: parseFloat(amount),
      type,
      category,
      note,
      date,
    };

    if (editId) {
      await updateDoc(doc(db, "users", user.uid, "expenses", editId), data);
      setEditId(null);
    } else {
      await addDoc(collection(db, "users", user.uid, "expenses"), data);
    }

    setAmount("");
    setNote("");
  };

  const deleteExpense = (id) =>
    deleteDoc(doc(db, "users", user.uid, "expenses", id));

  const editExpense = (e) => {
    setAmount(e.amount);
    setType(e.type);
    setCategory(e.category);
    setNote(e.note);
    setDate(e.date);
    setEditId(e.id);
  };

  // FILTER
  const filtered = expenses.filter((e) => {
    return (
      (!search || e.note?.toLowerCase().includes(search.toLowerCase())) &&
      (!filterCategory || e.category === filterCategory)
    );
  });

  // TOTALS
  const income = filtered
    .filter((e) => e.type === "income")
    .reduce((s, e) => s + e.amount, 0);

  const expense = filtered
    .filter((e) => e.type === "expense")
    .reduce((s, e) => s + e.amount, 0);

  const balance = income - expense;

  // CATEGORY DATA (only expenses)
  const categoryTotals = {};
  filtered
    .filter((e) => e.type === "expense")
    .forEach((e) => {
      categoryTotals[e.category] =
        (categoryTotals[e.category] || 0) + e.amount;
    });

  const pieData = Object.keys(categoryTotals).map((k) => ({
    name: k,
    value: categoryTotals[k],
  }));

  // TREND
  const trend = {};
  filtered.forEach((e) => {
    const day = new Date(e.date).getDate();
    trend[day] = (trend[day] || 0) + e.amount;
  });

  const trendData = Object.keys(trend).map((d) => ({
    day: d,
    amount: trend[d],
  }));

  // Budget alert
  useEffect(() => {
    if (budget && expense > budget) {
      alert("⚠️ Budget exceeded!");
    }
  }, [expense, budget]);

  // LOGIN UI
  if (!user) {
    return (
      <div style={{ padding: 20, textAlign: "center" }}>
        <h2>Login</h2>
        <input placeholder="Email" onChange={(e) => setEmail(e.target.value)} /><br />
        <input type="password" onChange={(e) => setPassword(e.target.value)} /><br />
        <button onClick={login}>Login</button>
        <button onClick={signup}>Signup</button>
        <br /><br />
        <button onClick={googleLogin}>Google Login</button>
      </div>
    );
  }

  return (
    <div style={{ padding: 15, maxWidth: 420, margin: "auto" }}>
      <h2>💸 Smart Finance Tracker</h2>
      <button onClick={logout}>Logout</button>

      {/* SUMMARY */}
      <div style={{ background: "#222", color: "white", padding: 10, borderRadius: 10 }}>
        <h3>Balance: ₹{balance}</h3>
        <p>Income: ₹{income}</p>
        <p>Expense: ₹{expense}</p>
      </div>

      {/* INPUT */}
      <input placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} />

      <select onChange={(e) => setType(e.target.value)}>
        <option value="expense">Expense</option>
        <option value="income">Income</option>
      </select>

      <input placeholder="Note" value={note} onChange={(e) => setNote(e.target.value)} />
      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />

      <select onChange={(e) => setCategory(e.target.value)}>
        <option>Food</option>
        <option>Travel</option>
        <option>Shopping</option>
        <option>Bills</option>
      </select>

      <button onClick={addExpense}>
        {editId ? "Update" : "Add"}
      </button>

      {/* FILTER */}
      <input placeholder="Search..." onChange={(e) => setSearch(e.target.value)} />

      {/* CHARTS */}
      <h4>Category Split</h4>
      <PieChart width={300} height={250}>
        <Pie data={pieData} dataKey="value" outerRadius={100} />
      </PieChart>

      <h4>Trend</h4>
      <LineChart width={300} height={200} data={trendData}>
        <XAxis dataKey="day" />
        <YAxis />
        <Tooltip />
        <Line dataKey="amount" />
      </LineChart>

      {/* LIST */}
      <ul>
        {filtered.map((e) => (
          <li key={e.id}>
            ₹{e.amount} ({e.type}) - {e.category}<br />
            {e.note}
            <br />
            <button onClick={() => editExpense(e)}>Edit</button>
            <button onClick={() => deleteExpense(e.id)}>Delete</button>
          </li>
        ))}
      </ul>
    </div>
  );
}