# 3D Pathfinding Visualiser

This is just a practice project where I implemented A* (A-star) pathfinding algorithm in Rust, compiled it to WebAssembly using [wasm-pack](https://github.com/rustwasm/wasm-pack), and then integrated into a browser-based frontend built with vanilla HTML, JavaScript, and WebGL for real-time visualisation of the pathfinding process. Also tried fiddling with [Toastify](https://github.com/apvarun/toastify-js) for explaining how the UI works.

## Live Demo
Hosted on Vercel:
https://3d-pathfinding-visualiser.vercel.app/

## Local Setup

- Clone this repo to a local system.
- Make sure you have rust and cargo installed.
  - If not, install [rustup](https://www.rust-lang.org/tools/install), which will install everything you'll need (almost).
- You'll also need `wasm-pack`. Run this command in a terminal.
```
cargo install wasm-pack
```
- Remove the pre-existing `pkg` folder and all the files in it from the local repo: `/3D-Pathfinding-Visualiser/web/pkg/`
- Open a terminal inside the local repo directory (`/3D-Pathfinding-Visualiser/`) and run this to compile the source to WASM and generate the necessary JavaScript bindings.
```
wasm-pack build --target web
```
- After the successful build, open the `index.js` file inside `web` folder and:
  - Remove/Comment the first import line.
  - Uncomment the second import line (which is commented).
  - Save the changes.
- Start an http server at 8080 to serve the web application.
  - Navigate to `/3D-Pathfinding-Visualiser/web/` in a terminal.
  - Run this command to use python to start an http server at `localhost:8080`.
```
python3 -m http.server 8080
```
- Open a web browser and open this link: http://localhost:8080/
