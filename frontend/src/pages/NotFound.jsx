import { Link } from "react-router-dom";
import Button from "../components/ui/Button.jsx";
import EmptyState from "../components/common/EmptyState.jsx";

export default function NotFound() {
  return (
    <EmptyState
      title="404 — Page not found"
      message="The page you're looking for doesn't exist."
      action={
        <Link to="/">
          <Button>Back to Dashboard</Button>
        </Link>
      }
    />
  );
}
