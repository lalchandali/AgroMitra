# ============================================================
#   AgroMitra — Plant Disease Detection Model
#   CNN + Transfer Learning (MobileNetV2)
#   Multi-Crop: Tomato, Potato, Rice + more
#   Uttara University | CSE Department
# ============================================================
#
#   HOW TO RUN:
#   1. pip install tensorflow scikit-learn matplotlib seaborn
#      pillow numpy pandas kaggle
#   2. Dataset download instructions নিচে দেখো
#   3. python disease_detection.py
#
# ============================================================

import os
import json
import pickle
import warnings
import numpy as np  # type: ignore[import]
import pandas as pd
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.ticker import FuncFormatter
import seaborn as sns
from pathlib import Path
from datetime import datetime

try:
    import tensorflow as tf  # type: ignore[import]
    from tensorflow.keras.applications import MobileNetV2  # type: ignore[import]
    from tensorflow.keras.models import Sequential, Model
    from tensorflow.keras.layers import (
        Dense, Dropout, GlobalAveragePooling2D,
        BatchNormalization, Input
    )
    try:
        from tensorflow.keras.preprocessing.image import ImageDataGenerator
    except ImportError:
        from keras_preprocessing.image import ImageDataGenerator
    from tensorflow.keras.callbacks import (
        EarlyStopping, ReduceLROnPlateau,
        ModelCheckpoint, TensorBoard
    )
    from tensorflow.keras.optimizers import Adam
    KERAS_AVAILABLE = True
except ImportError:
    tf = None
    MobileNetV2 = None
    Sequential = None
    Model = None
    Dense = None
    Dropout = None
    GlobalAveragePooling2D = None
    BatchNormalization = None
    Input = None
    EarlyStopping = None
    ReduceLROnPlateau = None
    ModelCheckpoint = None
    TensorBoard = None
    Adam = None
    try:
        from keras_preprocessing.image import ImageDataGenerator
    except ImportError:
        ImageDataGenerator = None
    KERAS_AVAILABLE = False

from sklearn.metrics import (
    classification_report, confusion_matrix,
    accuracy_score
)

warnings.filterwarnings('ignore')
if tf is not None:
    tf.get_logger().setLevel('ERROR')

plt.style.use('seaborn-v0_8-whitegrid')
COLORS = {
    'green':  '#2E7D32',
    'blue':   '#1565C0',
    'orange': '#E65100',
    'red':    '#B71C1C',
    'gold':   '#F9A825',
    'teal':   '#00695C',
    'gray':   '#546E7A',
}

print("\n" + "🌿"*30)
print("  AgroMitra — Plant Disease Detection Model")
print("  CNN + MobileNetV2 Transfer Learning")
print("  Uttara University | CSE Department")
print("🌿"*30)

# ============================================================
# CONFIG
# ============================================================
IMG_SIZE = 224       # MobileNetV2 input size
BATCH_SIZE = 32
# Reduced epochs for quick demo runs (change back for full training)
EPOCHS = 2
LEARN_RATE = 0.0001
DATA_DIR = r'E:\Personal\UU INFO\UU_Project\Final_Project\AgroMitra\ai_models\data\plant_disease'  # dataset folder
MODEL_DIR = 'models'
OUTPUT_DIR = 'output'

os.makedirs(MODEL_DIR,  exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ============================================================
# DISEASE CLASSES
# ============================================================

# PlantVillage dataset classes — 38 categories
DISEASE_CLASSES = {
    # Tomato (10 classes)
    'Tomato___Bacterial_spot':           {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Copper-based bactericide spray'},
    'Tomato___Early_blight':             {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Remove infected leaves, apply fungicide'},
    'Tomato___Late_blight':              {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply chlorothalonil fungicide immediately'},
    'Tomato___Leaf_Mold':                {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Improve ventilation, apply fungicide'},
    'Tomato___Septoria_leaf_spot':       {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Remove lower leaves, apply mancozeb'},
    'Tomato___Spider_mites':             {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply miticide or neem oil'},
    'Tomato___Target_Spot':              {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply fungicide, improve air circulation'},
    'Tomato___Tomato_Yellow_Leaf_Curl_Virus': {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'High', 'treatment': 'Remove infected plants, control whiteflies'},
    'Tomato___Tomato_mosaic_virus':      {'crop': 'Tomato', 'status': 'Diseased', 'severity': 'High',   'treatment': 'Remove infected plants, use resistant varieties'},
    'Tomato___healthy':                  {'crop': 'Tomato', 'status': 'Healthy',  'severity': 'None',   'treatment': 'No treatment needed'},

    # Potato (3 classes)
    'Potato___Early_blight':             {'crop': 'Potato', 'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply mancozeb or chlorothalonil fungicide'},
    'Potato___Late_blight':              {'crop': 'Potato', 'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply metalaxyl fungicide immediately'},
    'Potato___healthy':                  {'crop': 'Potato', 'status': 'Healthy',  'severity': 'None',   'treatment': 'No treatment needed'},

    # Rice (4 classes)
    'Rice___Brown_Spot':                 {'crop': 'Rice',   'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply tricyclazole or isoprothiolane'},
    'Rice___Leaf_Blast':                 {'crop': 'Rice',   'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply tricyclazole fungicide'},
    'Rice___Neck_Blast':                 {'crop': 'Rice',   'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply fungicide at heading stage'},
    'Rice___healthy':                    {'crop': 'Rice',   'status': 'Healthy',  'severity': 'None',   'treatment': 'No treatment needed'},

    # Corn/Maize (4 classes)
    'Corn_(maize)___Cercospora_leaf_spot': {'crop': 'Corn',  'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply strobilurin fungicide'},
    'Corn_(maize)___Common_rust_':       {'crop': 'Corn',   'status': 'Diseased', 'severity': 'Medium', 'treatment': 'Apply mancozeb or trifloxystrobin'},
    'Corn_(maize)___Northern_Leaf_Blight': {'crop': 'Corn',  'status': 'Diseased', 'severity': 'High',   'treatment': 'Apply fungicide at tasseling'},
    'Corn_(maize)___healthy':            {'crop': 'Corn',   'status': 'Healthy',  'severity': 'None',   'treatment': 'No treatment needed'},
}

CLASS_NAMES = list(DISEASE_CLASSES.keys())
NUM_CLASSES = len(CLASS_NAMES)

print(f"\n  📊 Total disease classes : {NUM_CLASSES}")
print(
    f"  🍅 Tomato diseases       : {sum(1 for v in DISEASE_CLASSES.values() if v['crop'] == 'Tomato')}")
print(
    f"  🥔 Potato diseases       : {sum(1 for v in DISEASE_CLASSES.values() if v['crop'] == 'Potato')}")
print(
    f"  🌾 Rice diseases         : {sum(1 for v in DISEASE_CLASSES.values() if v['crop'] == 'Rice')}")
print(
    f"  🌽 Corn diseases         : {sum(1 for v in DISEASE_CLASSES.values() if v['crop'] == 'Corn')}")


# ============================================================
# STEP 1: DATASET SETUP
# ============================================================
print("\n" + "="*60)
print("  STEP 1: Dataset Setup")
print("="*60)


def check_or_create_dataset():
    """
    Dataset আছে কিনা check করো।
    না থাকলে sample data তৈরি করো।
    """
    data_path = Path(DATA_DIR)

    if data_path.exists() and len(list(data_path.rglob('*.jpg'))) > 100:
        total = len(list(data_path.rglob('*.jpg'))) + \
            len(list(data_path.rglob('*.png')))
        print(f"  ✅ Dataset found: {total:,} images")
        return True

    print("  ⚠️  Dataset not found!")
    print("\n  📥 HOW TO GET THE DATASET:")
    print("  ─────────────────────────────────────────────")
    print("  Option 1 (Kaggle — Recommended):")
    print("    1. kaggle.com/datasets/emmarex/plantdisease")
    print("    2. Download and extract to: data/plant_disease/")
    print()
    print("  Option 2 (Direct Download):")
    print("    1. github.com/spMohanty/PlantVillage-Dataset")
    print("    2. Download 'raw/color' folder")
    print("    3. Put in: data/plant_disease/")
    print()
    print("  Option 3 (pip install):")
    print("    pip install tensorflow-datasets")
    print("    (Code will auto-download)")
    print("  ─────────────────────────────────────────────")
    print("\n  🔄 Creating SAMPLE dataset for demonstration...")
    create_sample_dataset()
    return False


def create_sample_dataset():
    """
    Real dataset না থাকলে sample images বানাও।
    Model structure test করার জন্য।
    """
    from PIL import Image
    import random

    sample_classes = list(DISEASE_CLASSES.keys())[:8]  # first 8 classes

    for split in ['train', 'val', 'test']:
        for cls in sample_classes:
            cls_path = Path(DATA_DIR) / split / cls
            cls_path.mkdir(parents=True, exist_ok=True)

            n_images = 60 if split == 'train' else 15 if split == 'val' else 10
            for i in range(n_images):
                # Create synthetic colored images
                r = random.randint(50, 200)
                g = random.randint(
                    80, 220) if 'healthy' in cls else random.randint(30, 120)
                b = random.randint(20, 100)
                noise = np.random.randint(
                    0, 255, (IMG_SIZE, IMG_SIZE, 3), dtype=np.uint8)
                base = np.full((IMG_SIZE, IMG_SIZE, 3), [
                               r, g, b], dtype=np.uint8)
                img_array = (base * 0.7 + noise * 0.3).astype(np.uint8)

                # Add disease patterns
                if 'healthy' not in cls:
                    n_spots = random.randint(5, 20)
                    for _ in range(n_spots):
                        x, y = random.randint(
                            20, IMG_SIZE-20), random.randint(20, IMG_SIZE-20)
                        size = random.randint(5, 25)
                        spot_color = [random.randint(100, 180), random.randint(
                            50, 100), random.randint(10, 50)]
                        img_array[max(0, y-size):y+size,
                                  max(0, x-size):x+size] = spot_color

                img = Image.fromarray(img_array)
                img.save(cls_path / f"sample_{i:04d}.jpg", quality=85)

    total = sum(1 for _ in Path(DATA_DIR).rglob('*.jpg'))
    print(f"  ✅ Sample dataset created: {total:,} images")
    print(f"  📁 Location: {DATA_DIR}/")
    print(f"  ⚠️  Replace with real PlantVillage dataset for better accuracy!")


# ============================================================
# STEP 2: DATA GENERATORS
# ============================================================
print("\n" + "="*60)
print("  STEP 2: Creating Data Generators")
print("="*60)


def create_data_generators():
    """
    Training, validation, test data generators তৈরি করো।
    Data augmentation সহ।
    """
    # Training: heavy augmentation
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=40,
        width_shift_range=0.2,
        height_shift_range=0.2,
        shear_range=0.2,
        zoom_range=0.2,
        horizontal_flip=True,
        vertical_flip=True,
        brightness_range=[0.7, 1.3],
        fill_mode='nearest',
    )

    # Validation/Test: only rescale
    val_datagen = ImageDataGenerator(rescale=1./255)

    train_path = Path(DATA_DIR) / 'train'
    val_path = Path(DATA_DIR) / 'val'
    test_path = Path(DATA_DIR) / 'test'

    # Check if split folders exist
    if not train_path.exists():
        # No split — create from main folder
        print("  📁 Creating train/val/test split...")
        create_split_from_flat(DATA_DIR)

    train_gen = train_datagen.flow_from_directory(
        str(train_path),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=True,
    )

    val_gen = val_datagen.flow_from_directory(
        str(val_path),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False,
    )

    test_gen = val_datagen.flow_from_directory(
        str(test_path),
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False,
    )

    # Save class indices
    class_indices = train_gen.class_indices
    idx_to_class = {v: k for k, v in class_indices.items()}
    with open(f'{MODEL_DIR}/class_indices.json', 'w') as f:
        json.dump(class_indices, f, indent=2)
    with open(f'{MODEL_DIR}/idx_to_class.json', 'w') as f:
        json.dump(idx_to_class, f, indent=2)

    print(
        f"  ✅ Train   : {train_gen.n:,} images, {train_gen.num_classes} classes")
    print(f"  ✅ Val     : {val_gen.n:,} images")
    print(f"  ✅ Test    : {test_gen.n:,} images")
    print(f"  ✅ Classes : {list(train_gen.class_indices.keys())[:5]}...")

    return train_gen, val_gen, test_gen, idx_to_class


def create_split_from_flat(data_dir, train_ratio=0.7, val_ratio=0.15):
    """Flat dataset থেকে train/val/test split তৈরি করো।"""
    import shutil
    import random
    src = Path(data_dir)
    classes = [d for d in src.iterdir() if d.is_dir() and d.name not in [
        'train', 'val', 'test']]

    for cls_dir in classes:
        images = list(cls_dir.glob('*.jpg')) + \
            list(cls_dir.glob('*.png')) + list(cls_dir.glob('*.JPG'))
        random.shuffle(images)

        n = len(images)
        n_tr = int(n * train_ratio)
        n_val = int(n * val_ratio)

        splits = {
            'train': images[:n_tr],
            'val':   images[n_tr:n_tr+n_val],
            'test':  images[n_tr+n_val:]
        }

        for split_name, split_images in splits.items():
            dest = src / split_name / cls_dir.name
            dest.mkdir(parents=True, exist_ok=True)
            for img_path in split_images:
                shutil.copy2(img_path, dest / img_path.name)

    print(f"  ✅ Split created from {len(classes)} classes")


# ============================================================
# STEP 3: BUILD MODEL
# ============================================================
print("\n" + "="*60)
print("  STEP 3: Building CNN Model (MobileNetV2)")
print("="*60)


def build_model(num_classes):
    """
    MobileNetV2 Transfer Learning model তৈরি করো।
    ImageNet weights ব্যবহার করো।
    """
    # Base model — pretrained on ImageNet
    base_model = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet',
    )

    # Phase 1: Freeze base model — শুধু top layers train করো
    base_model.trainable = False

    # Build model
    inputs = Input(shape=(IMG_SIZE, IMG_SIZE, 3))
    x = base_model(inputs, training=False)
    x = GlobalAveragePooling2D()(x)
    x = BatchNormalization()(x)
    x = Dense(512, activation='relu')(x)
    x = Dropout(0.4)(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.3)(x)
    outputs = Dense(num_classes, activation='softmax')(x)

    model = Model(inputs, outputs)

    model.compile(
        optimizer=Adam(learning_rate=LEARN_RATE),
        loss='categorical_crossentropy',
        metrics=['accuracy', 'top_k_categorical_accuracy']
    )

    print(f"  ✅ MobileNetV2 base model loaded (ImageNet weights)")
    print(f"  ✅ Output classes : {num_classes}")
    print(f"  ✅ Total params   : {model.count_params():,}")
    print(
        f"  ✅ Trainable      : {sum(tf.size(v).numpy() for v in model.trainable_variables):,}")

    return model, base_model


# ============================================================
# STEP 4: TRAIN MODEL
# ============================================================
def train_model(model, base_model, train_gen, val_gen, num_classes):
    """
    2-phase training:
    Phase 1: Top layers only (fast)
    Phase 2: Fine-tuning (unfreeze last layers)
    """
    callbacks = [
        EarlyStopping(
            monitor='val_accuracy', patience=8,
            restore_best_weights=True, verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss', factor=0.3,
            patience=4, min_lr=1e-7, verbose=1
        ),
        ModelCheckpoint(
            filepath=f'{MODEL_DIR}/disease_model_best.keras',
            monitor='val_accuracy', save_best_only=True, verbose=0
        )
    ]

    print("\n  📚 Phase 1: Training top layers (base frozen)...")
    history1 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=min(15, EPOCHS),
        callbacks=callbacks,
        verbose=1,
    )

    # Phase 2: Fine-tuning — unfreeze last 30 layers
    print("\n  🔓 Phase 2: Fine-tuning (unfreezing last 30 layers)...")
    base_model.trainable = True
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    model.compile(
        optimizer=Adam(learning_rate=LEARN_RATE / 10),
        loss='categorical_crossentropy',
        metrics=['accuracy', 'top_k_categorical_accuracy']
    )

    history2 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=EPOCHS,
        callbacks=callbacks,
        verbose=1,
    )

    # Combine histories
    combined = {}
    for key in history1.history:
        combined[key] = history1.history[key] + history2.history.get(key, [])

    return combined


# ============================================================
# STEP 5: EVALUATE MODEL
# ============================================================
def evaluate_model(model, test_gen, idx_to_class):
    """Model accuracy evaluate করো।"""
    print("\n" + "="*60)
    print("  STEP 5: Model Evaluation")
    print("="*60)

    # Predictions
    print("  🔄 Running predictions on test set...")
    y_pred_probs = model.predict(test_gen, verbose=0)
    y_pred = np.argmax(y_pred_probs, axis=1)
    y_true = test_gen.classes

    # Metrics
    accuracy = accuracy_score(y_true, y_pred) * 100
    top_k_acc = np.mean([
        y_true[i] in np.argsort(y_pred_probs[i])[-3:]
        for i in range(len(y_true))
    ]) * 100

    print(f"\n  📊 Performance Metrics:")
    print(
        f"     Overall Accuracy : {accuracy:.2f}%   {'✅ Excellent!' if accuracy >= 90 else '⚡ Good' if accuracy >= 80 else '⚠️ Needs improvement'}")
    print(f"     Top-3 Accuracy   : {top_k_acc:.2f}%")

    # Per-crop accuracy
    crops = {}
    for i, (true, pred) in enumerate(zip(y_true, y_pred)):
        true_class = idx_to_class.get(true, 'unknown')
        crop = true_class.split('___')[0] if '___' in true_class else 'Unknown'
        if crop not in crops:
            crops[crop] = {'correct': 0, 'total': 0}
        crops[crop]['total'] += 1
        if true == pred:
            crops[crop]['correct'] += 1

    print(f"\n  📊 Per-Crop Accuracy:")
    for crop, stats in crops.items():
        acc = stats['correct'] / stats['total'] * \
            100 if stats['total'] > 0 else 0
        print(
            f"     {crop:<20}: {acc:.1f}% ({stats['correct']}/{stats['total']})")

    return accuracy, y_pred, y_true, y_pred_probs


# ============================================================
# STEP 6: VISUALIZATIONS
# ============================================================
def plot_results(history, y_true, y_pred, y_pred_probs, idx_to_class, accuracy):
    """Training results এবং predictions visualize করো।"""
    print("\n" + "="*60)
    print("  STEP 6: Generating Visualizations")
    print("="*60)

    fig, axes = plt.subplots(2, 2, figsize=(18, 14))
    fig.suptitle(
        f'AgroMitra — Plant Disease Detection Results\n'
        f'MobileNetV2 | Accuracy: {accuracy:.1f}% | Uttara University',
        fontsize=14, fontweight='bold', color=COLORS['green'], y=1.01
    )

    # ── Chart 1: Training Accuracy ────────────────────────────
    ax1 = axes[0, 0]
    ax1.plot(history.get('accuracy', []),
             color=COLORS['blue'],   lw=2, label='Train Accuracy')
    ax1.plot(history.get('val_accuracy', []),
             color=COLORS['green'],  lw=2, label='Val Accuracy')
    ax1.set_title('Training History — Accuracy',
                  fontweight='bold', fontsize=12)
    ax1.set_xlabel('Epoch')
    ax1.set_ylabel('Accuracy')
    ax1.legend()
    ax1.yaxis.set_major_formatter(FuncFormatter(lambda y, _: f'{y:.0%}'))

    # ── Chart 2: Training Loss ────────────────────────────────
    ax2 = axes[0, 1]
    ax2.plot(history.get('loss', []),
             color=COLORS['orange'], lw=2, label='Train Loss')
    ax2.plot(history.get('val_loss', []),
             color=COLORS['red'],    lw=2, label='Val Loss')
    ax2.set_title('Training History — Loss', fontweight='bold', fontsize=12)
    ax2.set_xlabel('Epoch')
    ax2.set_ylabel('Loss')
    ax2.legend()

    # ── Chart 3: Per-Class Accuracy ───────────────────────────
    ax3 = axes[1, 0]
    class_names = sorted(
        set(idx_to_class.get(i, f'Class_{i}') for i in y_true))
    class_accs = []
    for cls in class_names:
        cls_idx = [i for i, x in enumerate(
            y_true) if idx_to_class.get(x, '') == cls]
        if cls_idx:
            correct = sum(1 for i in cls_idx if y_pred[i] == y_true[i])
            class_accs.append(correct / len(cls_idx) * 100)
        else:
            class_accs.append(0)

    short_names = [c.split('___')[-1].replace('_', ' ')[:20]
                   for c in class_names]
    bar_colors = [COLORS['green'] if a >= 90 else COLORS['blue']
                  if a >= 75 else COLORS['orange'] for a in class_accs]
    bars = ax3.barh(range(len(short_names)), class_accs,
                    color=bar_colors, edgecolor='white')
    ax3.set_yticks(range(len(short_names)))
    ax3.set_yticklabels(short_names, fontsize=9)
    ax3.set_title('Per-Class Detection Accuracy',
                  fontweight='bold', fontsize=12)
    ax3.set_xlabel('Accuracy (%)')
    ax3.axvline(x=90, color=COLORS['red'],
                linestyle='--', lw=1.5, label='90% threshold')
    ax3.set_xlim(0, 110)
    ax3.legend(fontsize=9)
    for bar, val in zip(bars, class_accs):
        ax3.text(bar.get_width() + 1, bar.get_y() + bar.get_height()/2,
                 f'{val:.0f}%', va='center', fontsize=9, fontweight='bold')

    # ── Chart 4: Disease Distribution ────────────────────────
    ax4 = axes[1, 1]
    crop_counts = {}
    for class_name in class_names:
        crop = class_name.split('___')[0] if '___' in class_name else 'Other'
        crop_counts[crop] = crop_counts.get(crop, 0) + 1

    crops = list(crop_counts.keys())
    counts = list(crop_counts.values())
    crop_colors = [COLORS['green'], COLORS['blue'],
                   COLORS['orange'], COLORS['teal'], COLORS['red']][:len(crops)]

    wedges, texts, autotexts = ax4.pie(
        counts, labels=crops, colors=crop_colors,
        autopct='%1.0f%%', startangle=90,
        pctdistance=0.85, labeldistance=1.1
    )
    for text in autotexts:
        text.set_fontsize(11)
        text.set_fontweight('bold')
    ax4.set_title('Disease Classes by Crop', fontweight='bold', fontsize=12)

    plt.tight_layout()
    chart_path = f'{OUTPUT_DIR}/disease_detection_results.png'
    plt.savefig(chart_path, dpi=150, bbox_inches='tight', facecolor='white')
    print(f"  ✅ Results chart saved: {chart_path}")
    plt.show()


# ============================================================
# STEP 7: PREDICTION FUNCTION
# ============================================================
def predict_disease(image_path, model, idx_to_class, top_k=3):
    """
    একটা image দেখে disease predict করো।
    """
    from PIL import Image

    img = Image.open(image_path).convert('RGB')
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    predictions = model.predict(img_array, verbose=0)[0]
    top_indices = np.argsort(predictions)[-top_k:][::-1]

    results = []
    for idx in top_indices:
        class_name = idx_to_class.get(idx, f'Class_{idx}')
        confidence = float(predictions[idx]) * 100
        disease_info = DISEASE_CLASSES.get(class_name, {
            'crop': 'Unknown', 'status': 'Unknown',
            'severity': 'Unknown', 'treatment': 'Consult an expert'
        })
        results.append({
            'class_name':  class_name,
            'crop':        disease_info['crop'],
            'disease':     class_name.split('___')[-1].replace('_', ' ') if '___' in class_name else class_name,
            'status':      disease_info['status'],
            'severity':    disease_info['severity'],
            'confidence':  round(confidence, 2),
            'treatment':   disease_info['treatment'],
        })

    return results


def save_prediction_demo(model, test_gen, idx_to_class):
    """Test images থেকে sample predictions দেখাও।"""
    print("\n  📸 Sample Predictions:")
    print(f"  {'Image':<30} {'Predicted':<30} {'Actual':<30} {'Conf'}")
    print(f"  {'-'*100}")

    test_gen.reset()
    batch_x, batch_y = next(test_gen)
    preds = model.predict(batch_x[:8], verbose=0)

    correct = 0
    for i in range(min(8, len(batch_x))):
        pred_idx = np.argmax(preds[i])
        actual_idx = np.argmax(batch_y[i])
        pred_class = idx_to_class.get(
            pred_idx, f'cls_{pred_idx}').split('___')[-1][:25]
        actual_class = idx_to_class.get(
            actual_idx, f'cls_{actual_idx}').split('___')[-1][:25]
        conf = preds[i][pred_idx] * 100
        match = '✅' if pred_idx == actual_idx else '❌'
        if pred_idx == actual_idx:
            correct += 1
        print(
            f"  {match} Sample {i+1:<23} {pred_class:<30} {actual_class:<30} {conf:.1f}%")

    print(f"\n  Batch accuracy: {correct}/8 = {correct/8*100:.0f}%")


# ============================================================
# MAIN
# ============================================================
def main():

    # ── Step 1: Dataset ──────────────────────────────────────
    has_real_data = check_or_create_dataset()

    if not KERAS_AVAILABLE:
        print("\n" + "="*60)
        print("  STEP 2: TensorFlow Missing")
        print("="*60)
        print("  ⚠️  TensorFlow is not installed.")
        print("  ✅ The dataset check / sample data creation completed successfully.")
        print("  🔧 Install TensorFlow to run training, evaluation, and prediction:")
        print("      pip install tensorflow-cpu")
        return

    # ── Step 2: Data Generators ──────────────────────────────
    print("\n" + "="*60)
    print("  STEP 2: Creating Data Generators")
    print("="*60)
    train_gen, val_gen, test_gen, idx_to_class = create_data_generators()
    num_classes = train_gen.num_classes

    # ── Step 3: Build Model ──────────────────────────────────
    print("\n" + "="*60)
    print("  STEP 3: Building Model")
    print("="*60)
    model, base_model = build_model(num_classes)

    # ── Step 4: Train Model ──────────────────────────────────
    print("\n" + "="*60)
    print(f"  STEP 4: Training Model ({EPOCHS} epochs max)")
    print("="*60)
    history = train_model(model, base_model, train_gen, val_gen, num_classes)

    # ── Step 5: Evaluate ─────────────────────────────────────
    accuracy, y_pred, y_true, y_pred_probs = evaluate_model(
        model, test_gen, idx_to_class)

    # ── Step 6: Visualize ────────────────────────────────────
    plot_results(history, y_true, y_pred, y_pred_probs, idx_to_class, accuracy)

    # ── Step 7: Sample Predictions ───────────────────────────
    save_prediction_demo(model, test_gen, idx_to_class)

    # ── Save Final Model ─────────────────────────────────────
    print("\n" + "="*60)
    print("  Saving Final Model")
    print("="*60)
    final_model_path = f'{MODEL_DIR}/disease_detection_final.keras'
    model.save(final_model_path)
    print(f"  ✅ Model saved : {final_model_path}")

    # Save disease info
    with open(f'{MODEL_DIR}/disease_classes.json', 'w', encoding='utf-8') as f:
        json.dump(DISEASE_CLASSES, f, ensure_ascii=False, indent=2)
    print(f"  ✅ Disease info: {MODEL_DIR}/disease_classes.json")

    # Save summary
    summary = {
        'model':          'MobileNetV2 Transfer Learning',
        'num_classes':    num_classes,
        'accuracy':       round(accuracy, 2),
        'img_size':       IMG_SIZE,
        'trained_at':     datetime.now().isoformat(),
        'university':     'Uttara University',
        'has_real_data':  has_real_data,
    }
    with open(f'{MODEL_DIR}/disease_model_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print("\n" + "🌿"*30)
    print("  ✅ AgroMitra Disease Detection Complete!")
    print(f"  📊 Final Accuracy : {accuracy:.2f}%")
    print(f"  📁 Model saved    : {final_model_path}")
    print(f"  📁 Check 'output/' for charts")
    print("🌿"*30)

    if not has_real_data:
        print("\n  💡 NOTE: Sample data was used.")
        print("  For real accuracy (90%+), download PlantVillage dataset:")
        print("  👉 kaggle.com/datasets/emmarex/plantdisease")


if __name__ == '__main__':
    main()
