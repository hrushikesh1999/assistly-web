import { lazy, Suspense } from "react";
import { useLocation } from "react-router-dom";
import { Loading } from "./ui";
const AdminApp = lazy(() => import("./AdminApp"));
const CustomerChat = lazy(() => import("./customer/CustomerChat"));
const Demo = lazy(() => import("./pages/Demo"));
export default function App() {
  const { pathname } = useLocation();
  return (
    <Suspense fallback={<Loading />}>
      {pathname === "/demo" || pathname === "/demo/" ? (
        <Demo />
      ) : pathname === "/chat" || pathname === "/chat/" ? (
        <CustomerChat />
      ) : (
        <AdminApp />
      )}
    </Suspense>
  );
}
