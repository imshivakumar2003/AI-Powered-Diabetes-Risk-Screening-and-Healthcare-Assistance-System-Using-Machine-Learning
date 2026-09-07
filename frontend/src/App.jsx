import { useLocation } from "react-router-dom";
import Layout from "./components/layout/Layout.jsx";
import AppRoutes from "./routes/AppRoutes.jsx";

const AUTH_ROUTES = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function App() {
  const location = useLocation();
  const isAuthPage = AUTH_ROUTES.includes(location.pathname);

  if (isAuthPage) {
    return <AppRoutes />;
  }

  return (
    <Layout>
      <AppRoutes />
    </Layout>
  );
}
