# webgl2-graph-plotter
A toy 2D graph plotter, with
- complex WebGL2 API instead of canvas API to draw graph (I don't care about efficient)
- low FPS, buggy shader code
- not friendly, error-prone function define feature
- one GL program per function (even the axes and grid has its own program too)
- only raw HTML and Javascript, no 3rd party library required

## Quickstarts

Just serve the `index.html`, and you're good to go (note that `python` must be installed)
```sh
python -m http.server 80
```

**Note:** your browser must support WebGL2

## Screenshot
![screenshot](/screenshot.png)