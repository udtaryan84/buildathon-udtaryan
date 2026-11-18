import { navigate } from "../lib/api.js";

export function Shell({ children, back }) {
  return (
    <div className="page">
      <header className="top">
        <a
          href="/"
          className="brand"
          onClick={(e) => {
            e.preventDefault();
            navigate("/");
          }}
        >
          <span className="logo">J</span> Jaisa Tha
        </a>
        {back && (
          <button className="ghost" onClick={() => navigate(back)}>
            Back
          </button>
        )}
      </header>
      {children}
    </div>
  );
}

const LABELS = { pre_existing: "Already there", normal_wear: "Normal wear", damage: "Damage" };

export function Chip({ category }) {
  return <span className={`chip ${category}`}>{LABELS[category] || category}</span>;
}

export function Spinner({ text }) {
  return (
    <div className="spinner-row">
      <span className="spinner" />
      {text}
    </div>
  );
}

export function Loading({ text = "Loading" }) {
  return (
    <Shell>
      <Spinner text={text} />
    </Shell>
  );
}
