# Heading animation bundle

`js/vendor/headings.js` is built from `headings.jsx` (React + `spring-text-engine`, pinned to 0.1.5).
The site itself stays plain HTML; only this bundle needs a build.

```sh
cd tools/headings
npm install
npm run build   # writes ../../js/vendor/headings.js
```
