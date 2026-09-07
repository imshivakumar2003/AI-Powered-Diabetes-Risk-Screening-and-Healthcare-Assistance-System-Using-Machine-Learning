import pandas as pd
import pickle
from sklearn.linear_model import LogisticRegression
from sklearn.impute import SimpleImputer

# Load dataset
df = pd.read_csv("diabetes_prediction_dataset.csv")

# Encode categorical columns
df["gender"] = df["gender"].map({"Male": 0, "Female": 1})
df["smoking_history"] = df["smoking_history"].astype("category").cat.codes

# Split features and target
X = df.drop("diabetes", axis=1)
y = df["diabetes"]

# Handle missing values (THIS FIXES THE ERROR)
imputer = SimpleImputer(strategy="mean")
X = imputer.fit_transform(X)

# Train model
model = LogisticRegression(max_iter=1000)
model.fit(X, y)

# Save model correctly
with open("diabetes_prediction_model.pkl", "wb") as f:
    pickle.dump(model, f)

print("Model trained and saved successfully")
