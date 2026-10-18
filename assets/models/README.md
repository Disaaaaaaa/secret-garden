# 3D models

The current garden is built **in code** (`js/three-scene.js`) from simple shapes,
so the first load is very fast and nothing heavy has to be downloaded.

If you want to replace an object with a real model later, export it as **.glb**
(GLB/GLTF), keep it small (under ~2 MB, compressed textures in WebP), put it in this
folder and load it with Three.js `GLTFLoader` only when it is needed (lazy loading).
