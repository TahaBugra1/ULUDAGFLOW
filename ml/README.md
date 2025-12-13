# ML Pipeline Overview

This folder hosts the end-to-end workflows that will replace the mock analytics currently shown in the Bursa UI. We start with pressure forecasting, trained on the WDN1 benchmark hydraulic network dataset, and then extend to anomaly / leak detection.

## Repository layout

```
ml/
  README.md                  <- this document
   pressure_forecasting/      <- data loaders, training scripts and utilities
   leak_modeling/             <- feature engineering and models for leak detection/localization
  artifacts/                 <- serialized models & metadata after training
```

## Dataset

The training data is the WDN1 hydraulic network benchmark (CSV files located under `../WDN1/`). Each scenario file is a 145×58 table containing flows, pressures, volumes and leak indicators for nodes 2–14 of a condominium-scale distribution system. See `WDN1/annotation WDS1.txt` for the original description.

## Roadmap

1. **Pressure Forecasting (this iteration)**
   - Aggregate all WDN1 scenarios into a single Pandas DataFrame with explicit column names.
   - Train a multi-output regression model that predicts the next-step pressure at nodes 2–9.
   - Serialize the model (Joblib) together with the feature metadata.
2. **Leak / Anomaly Detection**
   - Use `ml/leak_modeling` to engineer features and train detection/localization models.
   - Combine the probabilistic leak scores with Bursa map overlays in the React app.
3. **API Integration**
   - Wrap the trained models in a FastAPI microservice with `/predict-pressure` and `/detect-leak` endpoints.
   - Replace `services/mockBackend.ts` data providers with real HTTP calls.

## Usage

Training is orchestrated by `pressure_forecasting/train_pressure_model.py`. Example:

```bash
python -m ml.pressure_forecasting.train_pressure_model --data-root ..\WDN1\csv-dist-orig --model-out ml\artifacts
```

The script will output basic RMSE metrics per node and store the fitted estimator plus metadata for downstream serving.

Leak modeling can be run via:

```bash
python -m ml.leak_modeling.model_training ..\WDN1 --variant orig --test-size 0.25 --split-strategy scenario
```

This command trains leak detection, localization, and coordinate regression models using the engineered feature set while holding out entire scenarios for evaluation and reporting baseline metrics for comparison.
