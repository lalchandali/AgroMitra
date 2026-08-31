# simple runner to trigger table creation for every model
#
# Previously this imported the now-deleted database/main_with_db.py, which
# only registered User/Product/Order on Base.metadata (missing OrderItem,
# PlatformSettings, Review, Testimonial, Notification) — so running this
# script alone would silently create just 3 of the 8 tables. backend/main.py
# already imports every model and calls Base.metadata.create_all(), so it's
# the one source of truth for schema creation; this script just triggers that.
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parents[1]))
import backend.main as main  # noqa: F401 — import side effect creates all tables

print('imported backend.main — table creation attempted for all models')
