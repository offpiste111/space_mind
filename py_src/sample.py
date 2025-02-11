import imgkit

# wkhtmltoimage のパスを指定
config = imgkit.config(wkhtmltoimage='/usr/local/bin/wkhtmltoimage')  # パスを環境に合わせて変更

# HTMLをPNGに変換
imgkit.from_file("your.html", "output.png", config=config)
