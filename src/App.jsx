import { usePath } from "./lib/api.js";
import Home from "./pages/Home.jsx";
import NewInspection from "./pages/NewInspection.jsx";
import MoveIn from "./pages/MoveIn.jsx";
import Report from "./pages/Report.jsx";
import MoveOut from "./pages/MoveOut.jsx";
import Verdict from "./pages/Verdict.jsx";

export default function App() {
  const path = usePath();
  const [, section, id] = path.split("/");
  if (section === "new") return <NewInspection />;
  if (section === "i" && id) return <MoveIn id={id} />;
  if (section === "r" && id) return <Report id={id} />;
  if (section === "m" && id) return <MoveOut id={id} />;
  if (section === "v" && id) return <Verdict id={id} />;
  return <Home />;
}
