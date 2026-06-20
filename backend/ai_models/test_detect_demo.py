from PIL import Image, ImageDraw
import requests
import os

IMG_PATH = "test_leaf.jpg"
URL = "http://127.0.0.1:8001/api/v1/disease/detect"


def make_dummy_leaf(path):
    img = Image.new('RGB', (224, 224), color=(34, 139, 34))
    draw = ImageDraw.Draw(img)
    draw.ellipse((56, 40, 168, 152), fill=(20, 120, 20))
    img.save(path)


def post_image(path):
    with open(path, 'rb') as f:
        files = {'file': (os.path.basename(path), f, 'image/jpeg')}
        resp = requests.post(URL, files=files, timeout=10)
        try:
            print(resp.status_code)
            print(resp.json())
        except Exception:
            print(resp.text)


if __name__ == '__main__':
    make_dummy_leaf(IMG_PATH)
    post_image(IMG_PATH)
