# ============================================================
#   AgroMitra — Production Inference
#   ai_models/models/-এ যেসব crop/district-এর জন্য trained
#   Prophet+XGBoost / LSTM model পাওয়া যায়, শুধু তাদের জন্যই
#   এই মডিউল real prediction করে — বাকিদের জন্য None রিটার্ন করে,
#   caller (main.py) তখন deterministic statistical fallback-এ যায়।
#
#   এই ফাইল ইচ্ছাকৃতভাবে price_prediction.py / demand_forecasting_v2.py
#   import করে না — ওগুলো one-shot training script (প্রচুর print + module-level
#   কোড চলে), library হিসেবে import করার জন্য নিরাপদ না। তাই feature
#   engineering লজিক এখানে আলাদাভাবে (কিন্তু সেই দুই স্ক্রিপ্টের সাথে ম্যাচ করিয়ে)
#   লেখা হয়েছে — কোনো একটা বদলালে অন্যটাও sync রাখতে হবে।
# ============================================================

import os
import pickle
from datetime import timedelta

import numpy as np
import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, 'models')


def _safe_name(crop_name, district):
    return f"{crop_name}_{district}".replace(" ", "_")


# ════════════════════════════════════════════════════════════
#   PRICE — Prophet + XGBoost hybrid
# ════════════════════════════════════════════════════════════

_XGB_FEATURE_COLS = [
    'year', 'month', 'day', 'day_of_week', 'day_of_year',
    'week_of_year', 'quarter',
    'is_eid_season', 'is_harvest_season', 'is_winter', 'is_monsoon',
    'price_lag_1', 'price_lag_7', 'price_lag_14', 'price_lag_30',
    'rolling_mean_7', 'rolling_mean_14', 'rolling_mean_30',
    'rolling_std_7', 'price_change_1d', 'price_change_7d',
    'season_encoded', 'weather_encoded',
]


def _season_of(month):
    if month in (11, 12, 1, 2):
        return 'Winter'
    if month in (3, 4, 5):
        return 'Summer'
    if month in (6, 7, 8, 9):
        return 'Monsoon'
    return 'Autumn'


def price_model_available(crop_name, district):
    name = _safe_name(crop_name, district)
    return all(
        os.path.exists(os.path.join(MODELS_DIR, f))
        for f in (f'prophet_{name}.pkl', f'xgb_{name}.pkl', f'encoders_{name}.pkl')
    )


def predict_price_hybrid(history_df, crop_name, district, days,
                          prophet_weight=0.45, xgb_weight=0.55):
    """
    ট্রেইন করা Prophet + XGBoost model দিয়ে আসল hybrid price forecast।
    Trained artifact না থাকলে None রিটার্ন করে (caller তখন
    simple_price_forecast()-এ fallback করবে)। কোনো random noise নেই —
    একই input দিলে সবসময় একই output আসবে।
    """
    if not price_model_available(crop_name, district):
        return None

    name = _safe_name(crop_name, district)
    with open(os.path.join(MODELS_DIR, f'prophet_{name}.pkl'), 'rb') as f:
        prophet_model = pickle.load(f)
    with open(os.path.join(MODELS_DIR, f'xgb_{name}.pkl'), 'rb') as f:
        xgb_model = pickle.load(f)
    with open(os.path.join(MODELS_DIR, f'encoders_{name}.pkl'), 'rb') as f:
        encoders = pickle.load(f)

    # ── Prophet: নিজেই future dataframe বানিয়ে predict করতে পারে ──
    # note: Prophet-এর uncertainty-interval (yhat_lower/upper) নিজে থেকেই
    # internally np.random ব্যবহার করে sampling করে predict()-এর সময়, তাই
    # পুরোপুরি deterministic output পেতে call-এর ঠিক আগে seed ফিক্স করা হলো।
    np.random.seed(42)
    future = prophet_model.make_future_dataframe(periods=days, freq='D')
    prophet_forecast = prophet_model.predict(future).tail(days).reset_index(drop=True)

    # ── XGBoost: recursive (এক এক দিন করে) forecast — প্রতিটা future
    #    দিনের lag/rolling feature আগের (predicted) দিনগুলোর উপর নির্ভর করে,
    #    তাই একসাথে batch predict করা যায় না, ধাপে ধাপে করতে হয় ──
    work_df = history_df[['date', 'avg_price']].copy().sort_values('date').reset_index(drop=True)
    if 'weather_condition' in history_df.columns and history_df['weather_condition'].notna().any():
        last_weather = history_df['weather_condition'].dropna().iloc[-1]
    else:
        last_weather = 'Sunny'

    xgb_preds = []
    for _ in range(days):
        next_date = work_df['date'].iloc[-1] + timedelta(days=1)
        month = next_date.month
        prices = work_df['avg_price'].to_numpy(dtype=float)

        row = {
            'year': next_date.year, 'month': month, 'day': next_date.day,
            'day_of_week': next_date.weekday(),
            'day_of_year': next_date.timetuple().tm_yday,
            'week_of_year': int(pd.Timestamp(next_date).isocalendar().week),
            'quarter': (month - 1) // 3 + 1,
            'is_eid_season': 1 if month in (3, 4, 5) else 0,
            'is_harvest_season': 1 if month in (11, 12, 1) else 0,
            'is_winter': 1 if month in (11, 12, 1, 2) else 0,
            'is_monsoon': 1 if month in (6, 7, 8, 9) else 0,
            'price_lag_1': prices[-1],
            'price_lag_7': prices[-7] if len(prices) >= 7 else prices[-1],
            'price_lag_14': prices[-14] if len(prices) >= 14 else prices[-1],
            'price_lag_30': prices[-30] if len(prices) >= 30 else prices[-1],
            'rolling_mean_7': float(np.mean(prices[-7:])),
            'rolling_mean_14': float(np.mean(prices[-14:])) if len(prices) >= 14 else float(np.mean(prices)),
            'rolling_mean_30': float(np.mean(prices[-30:])) if len(prices) >= 30 else float(np.mean(prices)),
            'rolling_std_7': float(np.std(prices[-7:])) if len(prices) >= 2 else 0.0,
            'price_change_1d': (prices[-1] - prices[-2]) / prices[-2] if len(prices) >= 2 and prices[-2] else 0.0,
            'price_change_7d': (prices[-1] - prices[-8]) / prices[-8] if len(prices) >= 8 and prices[-8] else 0.0,
        }

        try:
            row['season_encoded'] = int(encoders['season'].transform([_season_of(month)])[0])
        except ValueError:
            row['season_encoded'] = 0
        try:
            row['weather_encoded'] = int(encoders['weather'].transform([last_weather])[0])
        except ValueError:
            row['weather_encoded'] = 0

        X_row = pd.DataFrame([row])[_XGB_FEATURE_COLS]
        pred_price = float(xgb_model.predict(X_row)[0])
        xgb_preds.append(pred_price)
        work_df = pd.concat(
            [work_df, pd.DataFrame([{'date': next_date, 'avg_price': pred_price}])],
            ignore_index=True,
        )

    # ── Weighted ensemble (deterministic — কোনো noise যোগ হয়নি) ──
    forecasts = []
    last_actual_price = float(history_df['avg_price'].iloc[-1])
    for i in range(days):
        p_yhat = float(prophet_forecast['yhat'].iloc[i])
        p_lo = float(prophet_forecast['yhat_lower'].iloc[i])
        p_hi = float(prophet_forecast['yhat_upper'].iloc[i])

        hybrid = max(0.0, prophet_weight * p_yhat + xgb_weight * xgb_preds[i])
        ci_ratio_lo = (p_lo / p_yhat) if p_yhat else 0.88
        ci_ratio_hi = (p_hi / p_yhat) if p_yhat else 1.12
        lower = max(0.0, hybrid * ci_ratio_lo)
        upper = hybrid * ci_ratio_hi

        prev = forecasts[-1]['predicted_price'] if forecasts else last_actual_price
        if hybrid > prev * 1.01:
            trend_label = "↑ Rising"
        elif hybrid < prev * 0.99:
            trend_label = "↓ Falling"
        else:
            trend_label = "→ Stable"

        forecasts.append({
            'date': (history_df['date'].iloc[-1] + timedelta(days=i + 1)).strftime('%Y-%m-%d'),
            'predicted_price': round(hybrid, 2),
            'lower_bound': round(lower, 2),
            'upper_bound': round(upper, 2),
            'trend': trend_label,
        })

    return forecasts


# ════════════════════════════════════════════════════════════
#   DEMAND — LSTM
# ════════════════════════════════════════════════════════════

_LSTM_LOOK_BACK = 60
_LSTM_FEATURE_COLS = [
    'quantity_available',           # TARGET (must stay first — index 0)
    'avg_price', 'price_roll_7', 'price_roll_14', 'price_lag_7',
    'demand_lag_1', 'demand_lag_7', 'demand_lag_14', 'demand_lag_21', 'demand_lag_30',
    'demand_roll_mean_7', 'demand_roll_mean_14', 'demand_roll_mean_30',
    'demand_roll_std_7', 'demand_roll_std_14', 'demand_roll_std_30',
    'month_sin', 'month_cos', 'dow_sin', 'dow_cos', 'doy_sin', 'doy_cos',
    'is_winter', 'is_summer', 'is_monsoon', 'is_eid', 'is_harvest', 'is_friday',
]


def demand_model_available(crop_name, district):
    name = _safe_name(crop_name, district)
    return (
        os.path.exists(os.path.join(MODELS_DIR, f'lstm_demand_v2_{name}.keras'))
        and os.path.exists(os.path.join(MODELS_DIR, f'demand_scaler_v2_{name}.pkl'))
    )


def _build_demand_features(data):
    """demand_forecasting_v2.py-এর STEP 2 feature engineering-এর সাথে sync রাখা আবশ্যক।"""
    data = data.copy()
    data['day_of_week'] = data['date'].dt.dayofweek
    data['day_of_year'] = data['date'].dt.dayofyear
    data['month'] = data['date'].dt.month

    data['is_winter'] = data['month'].isin([11, 12, 1, 2]).astype(float)
    data['is_summer'] = data['month'].isin([3, 4, 5]).astype(float)
    data['is_monsoon'] = data['month'].isin([6, 7, 8, 9]).astype(float)
    data['is_eid'] = data['month'].isin([4, 5]).astype(float)
    data['is_harvest'] = data['month'].isin([11, 12, 1]).astype(float)
    data['is_friday'] = (data['day_of_week'] == 4).astype(float)

    data['month_sin'] = np.sin(2 * np.pi * data['month'] / 12)
    data['month_cos'] = np.cos(2 * np.pi * data['month'] / 12)
    data['dow_sin'] = np.sin(2 * np.pi * data['day_of_week'] / 7)
    data['dow_cos'] = np.cos(2 * np.pi * data['day_of_week'] / 7)
    data['doy_sin'] = np.sin(2 * np.pi * data['day_of_year'] / 365)
    data['doy_cos'] = np.cos(2 * np.pi * data['day_of_year'] / 365)

    for lag in (1, 7, 14, 21, 30):
        data[f'demand_lag_{lag}'] = data['quantity_available'].shift(lag)
    for window in (7, 14, 30):
        data[f'demand_roll_mean_{window}'] = data['quantity_available'].rolling(window, min_periods=1).mean()
        data[f'demand_roll_std_{window}'] = data['quantity_available'].rolling(window, min_periods=1).std().fillna(0)

    data['price_roll_7'] = data['avg_price'].rolling(7, min_periods=1).mean()
    data['price_roll_14'] = data['avg_price'].rolling(14, min_periods=1).mean()
    data['price_lag_7'] = data['avg_price'].shift(7)
    return data


def predict_demand_lstm(history_df, crop_name, district, days):
    """
    ট্রেইন করা LSTM model দিয়ে আসল demand forecast। None রিটার্ন করে যদি
    trained model না থাকে বা যথেষ্ট history (≥60 দিন) না থাকে।

    সীমাবদ্ধতা: ভবিষ্যতের avg_price জানা নেই বলে price-নির্ভর feature
    (avg_price, price_roll_7/14, price_lag_7) শেষ known মানে carry-forward
    করা হয়েছে — demand অংশটাই real recursive LSTM prediction।
    """
    if not demand_model_available(crop_name, district):
        return None

    from tensorflow.keras.models import load_model  # local import — শুধু দরকার হলেই tensorflow লোড হবে

    name = _safe_name(crop_name, district)
    model = load_model(os.path.join(MODELS_DIR, f'lstm_demand_v2_{name}.keras'))
    with open(os.path.join(MODELS_DIR, f'demand_scaler_v2_{name}.pkl'), 'rb') as f:
        scaler = pickle.load(f)

    data = history_df[['date', 'avg_price', 'quantity_available']].copy().sort_values('date').reset_index(drop=True)
    feat = _build_demand_features(data).dropna().reset_index(drop=True)
    if len(feat) < _LSTM_LOOK_BACK:
        return None

    n_features = len(_LSTM_FEATURE_COLS)
    last_price = float(data['avg_price'].iloc[-1])
    last_price_roll7 = float(feat['price_roll_7'].iloc[-1])
    last_price_roll14 = float(feat['price_roll_14'].iloc[-1])
    last_price_lag7 = float(feat['price_lag_7'].iloc[-1])

    window = feat[_LSTM_FEATURE_COLS].tail(_LSTM_LOOK_BACK).to_numpy(dtype=float)
    scaled_window = scaler.transform(window)
    demand_hist = list(data['quantity_available'].to_numpy(dtype=float))
    last_date = data['date'].iloc[-1]
    mean_dem = float(data['quantity_available'].mean())

    def inv_transform_qty(scaled_val):
        dummy = np.zeros((1, n_features))
        dummy[0, 0] = scaled_val
        return max(0.0, float(scaler.inverse_transform(dummy)[0, 0]))

    forecasts = []
    for d in range(days):
        next_date = last_date + timedelta(days=d + 1)
        pred_scaled = model.predict(scaled_window.reshape(1, _LSTM_LOOK_BACK, n_features), verbose=0)
        pred_qty = inv_transform_qty(float(np.ravel(pred_scaled)[0]))
        demand_hist.append(pred_qty)

        month, dow, doy = next_date.month, next_date.weekday(), next_date.timetuple().tm_yday
        new_row_raw = {
            'quantity_available': pred_qty,
            'avg_price': last_price, 'price_roll_7': last_price_roll7,
            'price_roll_14': last_price_roll14, 'price_lag_7': last_price_lag7,
            'demand_lag_1': demand_hist[-2] if len(demand_hist) >= 2 else pred_qty,
            'demand_lag_7': demand_hist[-8] if len(demand_hist) >= 8 else pred_qty,
            'demand_lag_14': demand_hist[-15] if len(demand_hist) >= 15 else pred_qty,
            'demand_lag_21': demand_hist[-22] if len(demand_hist) >= 22 else pred_qty,
            'demand_lag_30': demand_hist[-31] if len(demand_hist) >= 31 else pred_qty,
            'demand_roll_mean_7': float(np.mean(demand_hist[-7:])),
            'demand_roll_mean_14': float(np.mean(demand_hist[-14:])),
            'demand_roll_mean_30': float(np.mean(demand_hist[-30:])),
            'demand_roll_std_7': float(np.std(demand_hist[-7:])) if len(demand_hist) >= 2 else 0.0,
            'demand_roll_std_14': float(np.std(demand_hist[-14:])) if len(demand_hist) >= 2 else 0.0,
            'demand_roll_std_30': float(np.std(demand_hist[-30:])) if len(demand_hist) >= 2 else 0.0,
            'month_sin': np.sin(2 * np.pi * month / 12), 'month_cos': np.cos(2 * np.pi * month / 12),
            'dow_sin': np.sin(2 * np.pi * dow / 7), 'dow_cos': np.cos(2 * np.pi * dow / 7),
            'doy_sin': np.sin(2 * np.pi * doy / 365), 'doy_cos': np.cos(2 * np.pi * doy / 365),
            'is_winter': 1.0 if month in (11, 12, 1, 2) else 0.0,
            'is_summer': 1.0 if month in (3, 4, 5) else 0.0,
            'is_monsoon': 1.0 if month in (6, 7, 8, 9) else 0.0,
            'is_eid': 1.0 if month in (4, 5) else 0.0,
            'is_harvest': 1.0 if month in (11, 12, 1) else 0.0,
            'is_friday': 1.0 if dow == 4 else 0.0,
        }
        new_row = np.array([[new_row_raw[c] for c in _LSTM_FEATURE_COLS]], dtype=float)
        scaled_window = np.vstack([scaled_window[1:], scaler.transform(new_row)])

        if pred_qty > mean_dem * 1.15:
            signal = "🟢 High Demand"
        elif pred_qty < mean_dem * 0.85:
            signal = "🔴 Low Demand"
        else:
            signal = "🟡 Normal"

        forecasts.append({
            'date': next_date.strftime('%Y-%m-%d'),
            'predicted_demand': int(round(pred_qty)),
            'lower_bound': int(round(pred_qty * 0.85)),
            'upper_bound': int(round(pred_qty * 1.15)),
            'market_signal': signal,
        })

    return forecasts, mean_dem
