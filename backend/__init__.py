import os

_REAL_BACKEND = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "AgroMitra", "backend"))
__path__ = [_REAL_BACKEND]
