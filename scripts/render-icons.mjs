// Render extension/icons/icon.svg to the PNG sizes Firefox and AMO use.
//
// Uses headless Firefox (via selenium-webdriver, already a dev dependency)
// to draw the SVG on a canvas, so no image tooling is needed.
//
//   npm run icons                          # Firefox found by Selenium Manager
//   FIREFOX_BIN=/path/to/firefox npm run icons
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const SIZES = [16, 32, 48, 96, 128];

const options = new firefox.Options().addArguments("-headless");
if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
const service = process.env.GECKODRIVER ? new firefox.ServiceBuilder(process.env.GECKODRIVER) : undefined;

let builder = new Builder().forBrowser("firefox").setFirefoxOptions(options);
if (service) builder = builder.setFirefoxService(service);
const driver = await builder.build();

try {
  const svg = await readFile(`${root}extension/icons/icon.svg`, "utf8");
  await driver.get("about:blank");
  const pngs = await driver.executeAsyncScript(
    `const [svg, sizes, done] = arguments;
     const img = new Image();
     img.onload = () => done(sizes.map((size) => {
       const c = document.createElement("canvas");
       c.width = c.height = size;
       const ctx = c.getContext("2d");
       ctx.imageSmoothingQuality = "high";
       ctx.drawImage(img, 0, 0, size, size);
       return c.toDataURL("image/png").split(",")[1];
     }));
     img.onerror = () => done(null);
     img.src = "data:image/svg+xml;base64," + btoa(svg);`,
    svg,
    SIZES
  );
  if (!pngs) throw new Error("Firefox could not load icon.svg");
  for (const [i, size] of SIZES.entries()) {
    const file = `${root}extension/icons/icon-${size}.png`;
    await writeFile(file, Buffer.from(pngs[i], "base64"));
    console.log(`wrote ${file}`);
  }
} finally {
  await driver.quit();
}
