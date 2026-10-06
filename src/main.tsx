import { createRoot } from "react-dom/client";
import App from "./App";
import { createIntegration } from "./lib/integration";
import { Transactions } from "./lib/transactions";
import "./styles.css";
const ports = createIntegration(window.ethereum);
const transactions = new Transactions(
  ports.contract,
  ports.lifecycle,
  {
    getItem: (key) => window.localStorage.getItem(key),
    setItem: (key, value) => window.localStorage.setItem(key, value),
    removeItem: (key) => window.localStorage.removeItem(key),
  },
);
createRoot(document.getElementById("root")!).render(
  <App
    contract={ports.contract}
    transactions={transactions}
    provider={window.ethereum}
  />,
);
