import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./hooks/useAuth";
import { AppLayout } from "./components/AppLayout";
import { RequireAuth } from "./components/RequireAuth";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Groups } from "./pages/Groups";
import { GroupDetails } from "./pages/GroupDetails";
import { AddExpense } from "./pages/AddExpense";
import { ExpenseDetails } from "./pages/ExpenseDetails";
import { Balances } from "./pages/Balances";
import { NotFound } from "./pages/NotFound";

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<AppLayout />}>
            <Route element={<RequireAuth />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:groupId" element={<GroupDetails />} />
              <Route path="/groups/:groupId/expenses/new" element={<AddExpense />} />
              <Route path="/groups/:groupId/expenses/:expenseId" element={<ExpenseDetails />} />
              <Route path="/groups/:groupId/balances" element={<Balances />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
