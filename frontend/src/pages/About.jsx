import Card from "../components/ui/Card.jsx";

export default function About() {
  return (
    <>
      <div className="page-head">
        <span className="eyebrow">Reference</span>
        <h1>About the Model</h1>
        <p className="sub">How this screening tool works, and its limits.</p>
      </div>

      <div className="grid grid-2">
        <Card title="Model">
          <p>
            A logistic regression classifier trained on a healthcare dataset
            of patient records. It outputs a binary result — Positive or
            Negative — along with an estimated probability where supported.
          </p>
        </Card>

        <Card title="Inputs Used">
          <p>
            Age, gender, BMI, HbA1c level, blood glucose level, hypertension
            status, heart disease status, and smoking history. Eight features
            total, matching the original training data.
          </p>
        </Card>

        <Card title="Preprocessing">
          <p>
            Categorical fields (gender, smoking history) are numerically
            encoded to match training. Missing numeric values are imputed
            using column means during training.
          </p>
        </Card>

        <Card title="Limitations">
          <p>
            This tool provides a statistical estimate based on patterns in
            historical data. It is not a medical diagnosis and should never
            replace professional clinical evaluation.
          </p>
        </Card>
      </div>
    </>
  );
}
