# ============================================================
#   AgroMitra — Crop Recommendation Engine
#   Content-Based Filtering + Scoring Algorithm
#   Uttara University | CSE Department
# ============================================================
#
#   HOW TO RUN:
#   1. pip install pandas numpy matplotlib seaborn scikit-learn tabulate
#   2. python crop_recommendation.py
#
# ============================================================

import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
import seaborn as sns
import warnings
import os
import json
from datetime import datetime

warnings.filterwarnings('ignore')
plt.style.use('seaborn-v0_8-whitegrid')

COLORS = {
    'green':  '#2E7D32',
    'blue':   '#1565C0',
    'orange': '#E65100',
    'red':    '#B71C1C',
    'gold':   '#F9A825',
    'teal':   '#00695C',
    'purple': '#6A1B9A',
    'gray':   '#546E7A',
    'lime':   '#558B2F',
}

print("\n" + "🌾"*30)
print("  AgroMitra — Crop Recommendation Engine")
print("  Uttara University | CSE Department")
print("🌾"*30)

os.makedirs('output', exist_ok=True)
os.makedirs('models', exist_ok=True)


# ============================================================
# CROP KNOWLEDGE BASE
# Bangladesh-specific crop data
# ============================================================

CROP_DB = {
    'Tomato': {
        'name_bn':          'টমেটো',
        'category':         'Vegetable',
        'grow_days':        75,
        'best_months':      [10, 11, 12, 1, 2],
        'soil_types':       ['Loam', 'Sandy Loam', 'Clay Loam'],
        'water_need':       'Medium',
        'temp_min':         15, 'temp_max': 30,
        'rainfall_min':     60, 'rainfall_max': 120,
        'avg_yield_kg':     8000,
        'avg_price_bdt':    28,
        'input_cost_bdt':   35000,
        'districts':        ['Bogura', 'Rajshahi', 'Cumilla', 'Dhaka', 'Chattogram'],
        'difficulty':       'Medium',
        'market_demand':    'High',
        'export_potential': False,
        'organic_possible': True,
        'risk_level':       'Medium',
    },
    'Onion': {
        'name_bn':          'পেঁয়াজ',
        'category':         'Vegetable',
        'grow_days':        120,
        'best_months':      [10, 11, 12, 1, 2, 3],
        'soil_types':       ['Loam', 'Sandy Loam'],
        'water_need':       'Low',
        'temp_min':         13, 'temp_max': 28,
        'rainfall_min':     50, 'rainfall_max': 100,
        'avg_yield_kg':     7000,
        'avg_price_bdt':    45,
        'input_cost_bdt':   40000,
        'districts':        ['Rajshahi', 'Pabna', 'Bogura', 'Faridpur'],
        'difficulty':       'Medium',
        'market_demand':    'Very High',
        'export_potential': True,
        'organic_possible': False,
        'risk_level':       'Medium',
    },
    'Potato': {
        'name_bn':          'আলু',
        'category':         'Vegetable',
        'grow_days':        90,
        'best_months':      [10, 11, 12, 1],
        'soil_types':       ['Sandy Loam', 'Loam'],
        'water_need':       'Medium',
        'temp_min':         10, 'temp_max': 25,
        'rainfall_min':     60, 'rainfall_max': 110,
        'avg_yield_kg':     20000,
        'avg_price_bdt':    22,
        'input_cost_bdt':   50000,
        'districts':        ['Bogura', 'Rangpur', 'Munshiganj', 'Comilla'],
        'difficulty':       'Easy',
        'market_demand':    'Very High',
        'export_potential': True,
        'organic_possible': False,
        'risk_level':       'Low',
    },
    'Brinjal': {
        'name_bn':          'বেগুন',
        'category':         'Vegetable',
        'grow_days':        60,
        'best_months':      [1, 2, 3, 9, 10, 11],
        'soil_types':       ['Loam', 'Clay Loam', 'Sandy Loam'],
        'water_need':       'Medium',
        'temp_min':         18, 'temp_max': 35,
        'rainfall_min':     70, 'rainfall_max': 130,
        'avg_yield_kg':     12000,
        'avg_price_bdt':    30,
        'input_cost_bdt':   28000,
        'districts':        ['Bogura', 'Cumilla', 'Dhaka', 'Rajshahi', 'Chattogram'],
        'difficulty':       'Easy',
        'market_demand':    'High',
        'export_potential': False,
        'organic_possible': True,
        'risk_level':       'Low',
    },
    'Cabbage': {
        'name_bn':          'বাঁধাকপি',
        'category':         'Vegetable',
        'grow_days':        70,
        'best_months':      [10, 11, 12, 1, 2],
        'soil_types':       ['Loam', 'Clay Loam'],
        'water_need':       'Medium',
        'temp_min':         10, 'temp_max': 25,
        'rainfall_min':     60, 'rainfall_max': 120,
        'avg_yield_kg':     25000,
        'avg_price_bdt':    20,
        'input_cost_bdt':   25000,
        'districts':        ['Bogura', 'Rajshahi', 'Cumilla', 'Dhaka'],
        'difficulty':       'Easy',
        'market_demand':    'High',
        'export_potential': False,
        'organic_possible': True,
        'risk_level':       'Low',
    },
    'Cauliflower': {
        'name_bn':          'ফুলকপি',
        'category':         'Vegetable',
        'grow_days':        65,
        'best_months':      [10, 11, 12, 1, 2],
        'soil_types':       ['Loam', 'Clay Loam'],
        'water_need':       'Medium',
        'temp_min':         12, 'temp_max': 25,
        'rainfall_min':     60, 'rainfall_max': 110,
        'avg_yield_kg':     15000,
        'avg_price_bdt':    28,
        'input_cost_bdt':   28000,
        'districts':        ['Bogura', 'Rajshahi', 'Cumilla', 'Dhaka'],
        'difficulty':       'Medium',
        'market_demand':    'High',
        'export_potential': False,
        'organic_possible': True,
        'risk_level':       'Low',
    },
    'Garlic': {
        'name_bn':          'রসুন',
        'category':         'Spice',
        'grow_days':        150,
        'best_months':      [10, 11, 12],
        'soil_types':       ['Sandy Loam', 'Loam'],
        'water_need':       'Low',
        'temp_min':         12, 'temp_max': 28,
        'rainfall_min':     40, 'rainfall_max': 90,
        'avg_yield_kg':     5000,
        'avg_price_bdt':    85,
        'input_cost_bdt':   45000,
        'districts':        ['Rajshahi', 'Faridpur', 'Bogura', 'Pabna'],
        'difficulty':       'Hard',
        'market_demand':    'Very High',
        'export_potential': True,
        'organic_possible': False,
        'risk_level':       'High',
    },
    'Carrot': {
        'name_bn':          'গাজর',
        'category':         'Vegetable',
        'grow_days':        80,
        'best_months':      [10, 11, 12, 1],
        'soil_types':       ['Sandy Loam', 'Loam'],
        'water_need':       'Medium',
        'temp_min':         10, 'temp_max': 22,
        'rainfall_min':     50, 'rainfall_max': 100,
        'avg_yield_kg':     18000,
        'avg_price_bdt':    35,
        'input_cost_bdt':   30000,
        'districts':        ['Bogura', 'Rajshahi', 'Dhaka'],
        'difficulty':       'Medium',
        'market_demand':    'Medium',
        'export_potential': False,
        'organic_possible': True,
        'risk_level':       'Medium',
    },
    'Rice': {
        'name_bn':          'ধান',
        'category':         'Grain',
        'grow_days':        120,
        'best_months':      [5, 6, 7, 11, 12],
        'soil_types':       ['Clay', 'Clay Loam', 'Loam'],
        'water_need':       'High',
        'temp_min':         20, 'temp_max': 38,
        'rainfall_min':     150, 'rainfall_max': 300,
        'avg_yield_kg':     4500,
        'avg_price_bdt':    55,
        'input_cost_bdt':   30000,
        'districts':        ['Bogura', 'Rajshahi', 'Cumilla', 'Dhaka', 'Chattogram'],
        'difficulty':       'Easy',
        'market_demand':    'Very High',
        'export_potential': False,
        'organic_possible': True,
        'risk_level':       'Low',
    },
    'Ginger': {
        'name_bn':          'আদা',
        'category':         'Spice',
        'grow_days':        240,
        'best_months':      [3, 4, 5],
        'soil_types':       ['Sandy Loam', 'Loam'],
        'water_need':       'Medium',
        'temp_min':         20, 'temp_max': 35,
        'rainfall_min':     150, 'rainfall_max': 250,
        'avg_yield_kg':     8000,
        'avg_price_bdt':    90,
        'input_cost_bdt':   60000,
        'districts':        ['Rajshahi', 'Rangpur', 'Sylhet'],
        'difficulty':       'Hard',
        'market_demand':    'High',
        'export_potential': True,
        'organic_possible': True,
        'risk_level':       'High',
    },
}

# ============================================================
# DISTRICT PROFILES
# ============================================================

DISTRICT_PROFILES = {
    'Bogura': {
        'soil_type':    'Loam',
        'avg_temp':     26,
        'avg_rainfall': 1500,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   'Vegetables' 'Potato',
    },
    'Rajshahi': {
        'soil_type':    'Sandy Loam' 'Barind Soil (বরেন্দ্র মাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1400,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Mango", "Wheat", "Rice", "Maize", "Lentil"],
    },
    'Cumilla': {
        'soil_type':    'Clay Loam',
        'avg_temp':     26,
        'avg_rainfall': 1800,
        'market_access':'Good',
        'irrigation':   'Limited',
        'speciality':   'Mixed Vegetables',
    },
    'Dhaka': {
        'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1800,
        'market_access':'Excellent',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Jute", "Wheat", "Mustard", "Vegetables"],
    },
    'Chattogram': {
        'soil_type':    'Clay Loam' 'Hill Soil (টিলা মাটি)',
        'avg_temp':     27,
        'avg_rainfall': 2800,
        'market_access':'Excellent',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Maize", "Banana", "Jackfruit", "Groundnut"],
    },
    'Khulna': {
        'soil_type':    'Sandy Loam' 'Saline Soil (খারাপ মাটি)',
        'avg_temp':     26,
        'avg_rainfall': 1600,
        'market_access':'Good',
        'irrigation':   'Limited',
        'speciality':   ["Shrimp", "Prawn", "Rice", "Vegetables", "Salt Tolerant Rice", "Watermelon", "Sunflower", "Coconut"],
    },
    'Barishal': {  
        'soil_type':    'Clay Loam' 'Peat Soil (পিট মাটি)',
        'avg_temp':     27,
        'avg_rainfall': 2200,
        'market_access':'Good',
        'irrigation':   'Limited',
        'speciality':   ["Rice", "Jute", "Vegetables", "Watermelon", "Sunflower", "Betel Nut", "Coconut", "Chili"],
    },  
    'Sylhet': {
        'soil_type':    'Loam' 'Red Brown Terrace Soil (লাল বাদামী মাটি)',
        'avg_temp':     25,
        'avg_rainfall': 3500,
        'market_access':'Limited',
        'irrigation':   'Limited',
        'speciality':   ["Tea", "Pineapple", "Jackfruit", "Banana", "Rice", "Vegetables"],
    },
    'Rangpur': {
        'soil_type':    'Sandy Loam' 'Teesta Alluvial Soil (তিস্তা ভাটির মাটি)',
        'avg_temp':     26,
        'avg_rainfall': 1200,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Sugarcane", "Vegetables", "Fruits", "Pulses"],
    },
    'Mymensingh': {
        'soil_type':    'Clay Loam' 'Red Brown Floodplain Soil (লাল বাদামী বন্যাদুর্গত মাটি)',
        'avg_temp':     26,
        'avg_rainfall': 2000,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    'Faridpur': {
        'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1700,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    'Pabna': {
        'soil_type':    'Sandy Loam' 'Barind Soil (বরেন্দ্র মাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1300,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables"],
    },
    'Munshiganj': {
        'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1800,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    'Rangamati': {
        'soil_type':    'Clay Loam' 'Hill Soil (টিলা মাটি)',
        'avg_temp':     25,
        'avg_rainfall': 4000,
        'market_access':'Limited',
        'irrigation':   'Limited',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    'Khagrachari': {
        'soil_type':    'Clay Loam' 'Hill Soil (টিলা মাটি)',
        'avg_temp':     25,
        'avg_rainfall': 4000,
        'market_access':'Limited',
        'irrigation':   'Limited',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    'Bandarban': {
        'soil_type':    'Clay Loam' 'Hill Soil (টিলা মাটি)',
        'avg_temp':     25,
        'avg_rainfall': 4000,
        'market_access':'Limited',
        'irrigation':   'Limited',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    'Naogaon': {
        'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1500,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
    },
    'Natore': {
            'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
            'avg_temp':     27,
            'avg_rainfall': 1500,
            'market_access':'Good',
            'irrigation':   'Available',
            'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
        },
    'Panchagarh': {
        'soil_type':    'Sandy Loam' 'Teesta Alluvial Soil (তিস্তা ভাটির মাটি)',
        'avg_temp':     26,
        'avg_rainfall': 1200,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
    },
    'Dinajpur': {
        'soil_type':    'Sandy Loam' 'Teesta Alluvial Soil (তিস্তা ভাটির মাটি)',
        'avg_temp':     26,
        'avg_rainfall': 1200,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
    },
    'Thakurgaon': {
            'soil_type':    'Sandy Loam' 'Teesta Alluvial Soil (তিস্তা ভাটির মাটি)',
            'avg_temp':     26,
            'avg_rainfall': 1200,
            'market_access':'Good',
            'irrigation':   'Available',
            'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
    },
    'Joypurhat': {
        'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1500,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
    },
    'Kushtia': {
        'soil_type':    'Loam' 'Alluvial Soil (পলিমাটি)',
        'avg_temp':     27,
        'avg_rainfall': 1500,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Wheat", "Maize", "Lentil", "Vegetables","Fruits", "Pulses","Mango", "Jackfruit", "Banana", "Papaya"],
    },
    'Jamalpur': {
        'soil_type':    'Clay Loam' 'Red Brown Floodplain Soil (লাল বাদামী বন্যাদুর্গত মাটি)',
        'avg_temp':     26,
        'avg_rainfall': 2000,
        'market_access':'Good',
        'irrigation':   'Available',
        'speciality':   ["Rice", "Jute", "Vegetables", "Fruits", "Pulses", "Banana", "Papaya"],
    },
    
}


# ============================================================
# SCORING ENGINE
# ============================================================

def get_current_season(month):
    if month in [11,12,1,2]: return 'Winter'
    elif month in [3,4,5]:   return 'Summer'
    elif month in [6,7,8,9]: return 'Monsoon'
    else:                     return 'Autumn'


def score_crop(crop_name, crop_info, farmer_profile, market_data=None):
    """
    প্রতিটা crop-এর জন্য 0-100 score calculate করো।
    Multiple factors-এর weighted average।
    """
    scores = {}

    district  = farmer_profile['district']
    month     = farmer_profile['planting_month']
    soil      = farmer_profile['soil_type']
    land_acre = farmer_profile['land_acres']
    budget    = farmer_profile['budget_bdt']
    exp_level = farmer_profile['experience']   # Beginner/Intermediate/Expert

    dist_info = DISTRICT_PROFILES.get(district, DISTRICT_PROFILES['Bogura'])

    # ── 1. Season Suitability (25%) ───────────────────────────
    if month in crop_info['best_months']:
        season_score = 100
    elif any(abs(month - m) <= 1 or abs(month - m) == 11
             for m in crop_info['best_months']):
        season_score = 65
    else:
        season_score = 20
    scores['season'] = season_score

    # ── 2. Soil Compatibility (20%) ───────────────────────────
    if soil in crop_info['soil_types']:
        soil_score = 100
    elif soil == 'Loam':
        soil_score = 70   # Loam works for most crops
    else:
        soil_score = 40
    scores['soil'] = soil_score

    # ── 3. District Suitability (15%) ─────────────────────────
    if district in crop_info['districts']:
        dist_score = 100
    else:
        dist_score = 50
    scores['district'] = dist_score

    # ── 4. Profitability (20%) ────────────────────────────────
    revenue    = crop_info['avg_yield_kg'] * crop_info['avg_price_bdt'] * land_acre
    cost       = crop_info['input_cost_bdt'] * land_acre
    profit     = revenue - cost
    profit_margin = (profit / revenue * 100) if revenue > 0 else 0
    profit_score  = min(100, max(0, profit_margin * 1.5))
    scores['profitability'] = profit_score

    # ── 5. Budget Feasibility (10%) ───────────────────────────
    total_cost = crop_info['input_cost_bdt'] * land_acre
    if budget >= total_cost * 1.2:
        budget_score = 100
    elif budget >= total_cost:
        budget_score = 80
    elif budget >= total_cost * 0.8:
        budget_score = 50
    else:
        budget_score = 20
    scores['budget'] = budget_score

    # ── 6. Difficulty vs Experience (10%) ─────────────────────
    difficulty_map  = {'Easy': 1, 'Medium': 2, 'Hard': 3}
    experience_map  = {'Beginner': 1, 'Intermediate': 2, 'Expert': 3}
    diff_val = difficulty_map.get(crop_info['difficulty'], 2)
    exp_val  = experience_map.get(exp_level, 2)

    if exp_val >= diff_val:
        exp_score = 100
    elif exp_val == diff_val - 1:
        exp_score = 60
    else:
        exp_score = 25
    scores['experience'] = exp_score

    # Weighted Final Score
    weights = {
        'season':        0.25,
        'soil':          0.20,
        'district':      0.15,
        'profitability': 0.20,
        'budget':        0.10,
        'experience':    0.10,
    }

    final_score = sum(scores[k] * weights[k] for k in weights)

    # Estimated profit calculation
    est_revenue = crop_info['avg_yield_kg'] * crop_info['avg_price_bdt'] * land_acre
    est_cost    = crop_info['input_cost_bdt'] * land_acre
    est_profit  = est_revenue - est_cost

    return {
        'crop':             crop_name,
        'name_bn':          crop_info['name_bn'],
        'category':         crop_info['category'],
        'final_score':      round(final_score, 1),
        'scores':           scores,
        'est_revenue_bdt':  int(est_revenue),
        'est_cost_bdt':     int(est_cost),
        'est_profit_bdt':   int(est_profit),
        'profit_margin_pct':round((est_profit/est_revenue*100) if est_revenue > 0 else 0, 1),
        'grow_days':        crop_info['grow_days'],
        'avg_yield_kg':     int(crop_info['avg_yield_kg'] * land_acre),
        'difficulty':       crop_info['difficulty'],
        'market_demand':    crop_info['market_demand'],
        'risk_level':       crop_info['risk_level'],
        'water_need':       crop_info['water_need'],
        'export_potential': crop_info['export_potential'],
        'organic_possible': crop_info['organic_possible'],
    }


def get_recommendations(farmer_profile, top_n=5):
    """
    Farmer-এর জন্য top N crop recommendations দাও।
    """
    results = []
    for crop_name, crop_info in CROP_DB.items():
        score = score_crop(crop_name, crop_info, farmer_profile)
        results.append(score)

    # Sort by final score
    results.sort(key=lambda x: x['final_score'], reverse=True)
    return results[:top_n]


# ============================================================
# VISUALIZATIONS
# ============================================================

def plot_recommendations(recommendations, farmer_profile):
    """
    সুন্দর recommendation charts তৈরি করো।
    """
    fig, axes = plt.subplots(2, 2, figsize=(18, 13))
    fig.suptitle(
        f"AgroMitra — Crop Recommendation Report\n"
        f"Farmer: {farmer_profile['name']} | {farmer_profile['district']} | "
        f"{farmer_profile['land_acres']} acres | Budget: ৳{farmer_profile['budget_bdt']:,}",
        fontsize=14, fontweight='bold', color=COLORS['green'], y=1.01
    )

    crops      = [r['crop']         for r in recommendations]
    scores     = [r['final_score']  for r in recommendations]
    profits    = [r['est_profit_bdt']/1000 for r in recommendations]
    margins    = [r['profit_margin_pct']   for r in recommendations]

    bar_colors = [
        COLORS['green']  if s >= 75 else
        COLORS['blue']   if s >= 60 else
        COLORS['orange'] if s >= 45 else
        COLORS['gray']
        for s in scores
    ]

    # ── Chart 1: Recommendation Scores ───────────────────────
    ax1 = axes[0, 0]
    bars = ax1.barh(crops[::-1], scores[::-1],
                    color=bar_colors[::-1], edgecolor='white', linewidth=0.8)
    ax1.set_xlim(0, 105)
    ax1.set_title('Crop Recommendation Score (0–100)', fontweight='bold', fontsize=12)
    ax1.set_xlabel('Score')
    for bar, score in zip(bars, scores[::-1]):
        ax1.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                 f'{score:.1f}', va='center', fontweight='bold', fontsize=11)
    ax1.axvline(x=75, color=COLORS['red'], linestyle='--', lw=1.5, alpha=0.6, label='Recommended threshold')
    ax1.legend(fontsize=9)

    # ── Chart 2: Estimated Profit ─────────────────────────────
    ax2 = axes[0, 1]
    profit_colors = [COLORS['green'] if p > 0 else COLORS['red'] for p in profits]
    bars2 = ax2.bar(crops, profits, color=profit_colors, edgecolor='white', linewidth=0.8)
    ax2.set_title('Estimated Profit (৳ thousands/season)', fontweight='bold', fontsize=12)
    ax2.set_xlabel('Crop')
    ax2.set_ylabel('Profit (৳ thousand)')
    for bar, val in zip(bars2, profits):
        ax2.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.5,
                 f'৳{val:.1f}K', ha='center', fontweight='bold', fontsize=10)
    ax2.axhline(y=0, color='black', lw=0.8)
    plt.setp(ax2.xaxis.get_majorticklabels(), rotation=20)

    # ── Chart 3: Spider/Radar for Top Crop ───────────────────
    ax3 = axes[1, 0]
    top = recommendations[0]
    categories  = ['Season\nFit', 'Soil\nMatch', 'District\nFit',
                    'Profit-\nability', 'Budget\nFit', 'Experience\nMatch']
    values      = [
        top['scores']['season'],
        top['scores']['soil'],
        top['scores']['district'],
        top['scores']['profitability'],
        top['scores']['budget'],
        top['scores']['experience'],
    ]

    # Radar chart
    N       = len(categories)
    angles  = [n / float(N) * 2 * np.pi for n in range(N)]
    angles += angles[:1]
    vals    = values + values[:1]

    ax3 = plt.subplot(2, 2, 3, polar=True)
    ax3.plot(angles, vals,  color=COLORS['green'], linewidth=2)
    ax3.fill(angles, vals,  color=COLORS['green'], alpha=0.25)
    ax3.set_xticks(angles[:-1])
    ax3.set_xticklabels(categories, fontsize=10)
    ax3.set_ylim(0, 100)
    ax3.set_title(
        f'Top Pick: {top["crop"]} ({top["name_bn"]})\nScore: {top["final_score"]}/100',
        fontweight='bold', fontsize=12, pad=20
    )
    ax3.set_yticks([25, 50, 75, 100])
    ax3.set_yticklabels(['25', '50', '75', '100'], fontsize=8)
    ax3.grid(True, alpha=0.3)

    # ── Chart 4: Risk vs Profit Matrix ────────────────────────
    ax4 = axes[1, 1]
    risk_map   = {'Low': 1, 'Medium': 2, 'High': 3}
    demand_map = {'Low': 1, 'Medium': 2, 'High': 3, 'Very High': 4}

    for r in recommendations:
        x = risk_map.get(r['risk_level'], 2)
        y = demand_map.get(r['market_demand'], 2)
        size = max(200, r['final_score'] * 8)
        color = (COLORS['green']  if r['final_score'] >= 75 else
                 COLORS['blue']   if r['final_score'] >= 60 else
                 COLORS['orange'])
        ax4.scatter(x, y, s=size, color=color, alpha=0.8, zorder=5,
                    edgecolors='white', linewidth=1.5)
        ax4.annotate(f"{r['crop']}\n({r['final_score']})",
                     (x, y), textcoords='offset points',
                     xytext=(10, 5), fontsize=9, fontweight='bold')

    ax4.set_xlim(0.5, 3.5)
    ax4.set_ylim(0.5, 4.5)
    ax4.set_xticks([1, 2, 3])
    ax4.set_xticklabels(['Low Risk', 'Medium Risk', 'High Risk'])
    ax4.set_yticks([1, 2, 3, 4])
    ax4.set_yticklabels(['Low\nDemand', 'Medium\nDemand',
                          'High\nDemand', 'Very High\nDemand'])
    ax4.set_title('Risk vs Market Demand Matrix\n(Bubble size = Score)',
                  fontweight='bold', fontsize=12)
    ax4.axhline(y=2.5, color=COLORS['gray'], linestyle='--', alpha=0.4)
    ax4.axvline(x=2,   color=COLORS['gray'], linestyle='--', alpha=0.4)

    # Ideal zone
    ax4.add_patch(mpatches.FancyArrowPatch(
        (0.5, 2.5), (2, 4.5),
        arrowstyle='-', color=COLORS['green'], alpha=0.15, linewidth=0
    ))
    ax4.text(0.7, 4.2, '✅ Ideal\nZone', color=COLORS['green'],
             fontsize=9, fontweight='bold', alpha=0.7)

    plt.tight_layout()
    chart_path = f"output/crop_recommendation_{farmer_profile['district']}.png"
    plt.savefig(chart_path, dpi=150, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    print(f"  ✅ Chart saved: {chart_path}")
    plt.show()


# ============================================================
# PRINT RECOMMENDATION REPORT
# ============================================================

def print_report(recommendations, farmer_profile):
    """
    Detailed text report print করো।
    """
    print("\n" + "="*65)
    print("  🌾 AGROMITRA CROP RECOMMENDATION REPORT")
    print("="*65)
    print(f"  Farmer     : {farmer_profile['name']}")
    print(f"  District   : {farmer_profile['district']}")
    print(f"  Soil Type  : {farmer_profile['soil_type']}")
    print(f"  Land       : {farmer_profile['land_acres']} acres")
    print(f"  Budget     : ৳{farmer_profile['budget_bdt']:,}")
    print(f"  Experience : {farmer_profile['experience']}")
    print(f"  Season     : {get_current_season(farmer_profile['planting_month'])}")
    print("="*65)

    rank_symbols = ['🥇', '🥈', '🥉', '4️⃣ ', '5️⃣ ']

    for i, rec in enumerate(recommendations):
        symbol = rank_symbols[i] if i < len(rank_symbols) else f"{i+1}."
        print(f"\n  {symbol} {rec['crop']} ({rec['name_bn']})")
        print(f"     Score          : {rec['final_score']}/100  {'⭐⭐⭐' if rec['final_score']>=80 else '⭐⭐' if rec['final_score']>=65 else '⭐'}")
        print(f"     Category       : {rec['category']}")
        print(f"     Growing Days   : {rec['grow_days']} days")
        print(f"     Difficulty     : {rec['difficulty']}")
        print(f"     Market Demand  : {rec['market_demand']}")
        print(f"     Risk Level     : {rec['risk_level']}")
        print(f"     Water Need     : {rec['water_need']}")
        print(f"     Est. Yield     : {rec['avg_yield_kg']:,} kg")
        print(f"     Est. Revenue   : ৳{rec['est_revenue_bdt']:,}")
        print(f"     Est. Cost      : ৳{rec['est_cost_bdt']:,}")
        print(f"     Est. Profit    : ৳{rec['est_profit_bdt']:,}  ({rec['profit_margin_pct']}% margin)")
        print(f"     Export Ready   : {'✅ Yes' if rec['export_potential'] else '❌ No'}")
        print(f"     Organic Capable: {'✅ Yes' if rec['organic_possible'] else '❌ No'}")

    # Top pick advisory
    top = recommendations[0]
    print(f"\n  💡 AgroMitra Recommendation:")
    print(f"     Best crop for you this season: {top['crop']} ({top['name_bn']})")
    print(f"     Expected profit: ৳{top['est_profit_bdt']:,} in {top['grow_days']} days")

    if top['risk_level'] == 'Low':
        print(f"     ✅ Low risk — Safe choice for all farmers!")
    elif top['risk_level'] == 'Medium':
        print(f"     ⚡ Medium risk — Good choice with proper planning.")
    else:
        print(f"     ⚠️  High risk — Only attempt with experience!")
    print("="*65)


# ============================================================
# SAVE MODEL / KNOWLEDGE BASE
# ============================================================

def save_knowledge_base():
    kb_path = 'models/crop_knowledge_base.json'
    with open(kb_path, 'w', encoding='utf-8') as f:
        json.dump(CROP_DB, f, ensure_ascii=False, indent=2, default=str)
    print(f"  ✅ Knowledge base saved: {kb_path}")

    dp_path = 'models/district_profiles.json'
    with open(dp_path, 'w', encoding='utf-8') as f:
        json.dump(DISTRICT_PROFILES, f, ensure_ascii=False, indent=2)
    print(f"  ✅ District profiles saved: {dp_path}")


# ============================================================
# MAIN
# ============================================================

def main():

    # ── Farmer Profile — এখানে farmer-এর details দাও ──────
    farmer_profile = {
        'name':           'Mohammad Rahim',      # Farmer name
        'district':       'Bogura',              # District
        'soil_type':      'Loam',                # Soil type
        'land_acres':     2.5,                   # Land in acres
        'budget_bdt':     80000,                 # Budget in BDT
        'experience':     'Intermediate',        # Beginner/Intermediate/Expert
        'planting_month': datetime.now().month,  # Current month
    }

    print(f"\n  👨‍🌾 Generating recommendations for:")
    print(f"     Farmer  : {farmer_profile['name']}")
    print(f"     District: {farmer_profile['district']}")
    print(f"     Season  : {get_current_season(farmer_profile['planting_month'])}")
    print(f"     Land    : {farmer_profile['land_acres']} acres")
    print(f"     Budget  : ৳{farmer_profile['budget_bdt']:,}")

    # ── Get Recommendations ──────────────────────────────────
    print("\n" + "="*60)
    print("  Calculating crop scores...")
    print("="*60)

    recommendations = get_recommendations(farmer_profile, top_n=5)

    # ── Print Report ─────────────────────────────────────────
    print_report(recommendations, farmer_profile)

    # ── Visualize ────────────────────────────────────────────
    print("\n  Generating charts...")
    plot_recommendations(recommendations, farmer_profile)

    # ── Save ─────────────────────────────────────────────────
    print("\n" + "="*60)
    print("  Saving Knowledge Base")
    print("="*60)
    save_knowledge_base()

    # Save recommendations to CSV
    rec_df = pd.DataFrame(recommendations)
    csv_path = f"output/recommendations_{farmer_profile['district']}.csv"
    rec_df.to_csv(csv_path, index=False)
    print(f"  ✅ Recommendations CSV: {csv_path}")

    print("\n" + "🌾"*30)
    print("  ✅ Crop Recommendation Engine Complete!")
    print("  📁 Check 'output/' for charts & CSV")
    print("  📁 Check 'models/' for knowledge base")
    print("🌾"*30 + "\n")

    # ── Try different farmer profiles ────────────────────────
    print("\n" + "="*60)
    print("  Testing Multiple Farmer Profiles")
    print("="*60)

    test_profiles = [
        {
            'name': 'Abdul Karim', 'district': 'Rajshahi',
            'soil_type': 'Sandy Loam', 'land_acres': 1.5,
            'budget_bdt': 50000, 'experience': 'Beginner',
            'planting_month': 11,
        },
        {
            'name': 'Fatema Begum', 'district': 'Cumilla',
            'soil_type': 'Clay Loam', 'land_acres': 3.0,
            'budget_bdt': 120000, 'experience': 'Expert',
            'planting_month': 5,
        },
    ]

    for profile in test_profiles:
        recs = get_recommendations(profile, top_n=3)
        print(f"\n  👨‍🌾 {profile['name']} | {profile['district']} | "
              f"{get_current_season(profile['planting_month'])} season")
        print(f"  {'Rank':<6}{'Crop':<15}{'Score':<10}{'Est Profit':<18}{'Risk'}")
        print(f"  {'-'*55}")
        for j, r in enumerate(recs):
            print(f"  {j+1:<6}{r['crop']:<15}{r['final_score']:<10}"
                  f"৳{r['est_profit_bdt']:>10,}{'':<6}{r['risk_level']}")


if __name__ == '__main__':
    main()
