// Render the AMO listing screenshots (1280x800 PNG) from amo/screenshots/compose.html.
//
//   npm run screenshots
//   FIREFOX_BIN=/path/to/firefox GECKODRIVER=/path/to/geckodriver npm run screenshots
import { writeFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Builder } from "selenium-webdriver";
import firefox from "selenium-webdriver/firefox.js";

const root = fileURLToPath(new URL("..", import.meta.url));
const options = new firefox.Options().addArguments("-headless");
// Light theme for the mock browser page; the stage itself is always dark.
options.setPreference("layout.css.prefers-color-scheme.content-override", 1);
if (process.env.FIREFOX_BIN) options.setBinary(process.env.FIREFOX_BIN);
let builder = new Builder().forBrowser("firefox").setFirefoxOptions(options);
if (process.env.GECKODRIVER) builder = builder.setFirefoxService(new firefox.ServiceBuilder(process.env.GECKODRIVER));
const driver = await builder.build();

try {
  await driver.manage().window().setRect({ width: 1280, height: 800 });
  // Make the viewport exactly 1280x800 regardless of window chrome.
  const [w, h] = await driver.executeScript("return [window.outerWidth - window.innerWidth, window.outerHeight - window.innerHeight]");
  await driver.manage().window().setRect({ width: 1280 + w, height: 800 + h });
  const page = pathToFileURL(`${root}amo/screenshots/compose.html`).href;
  for (const shot of [1, 2, 3]) {
    await driver.get(`${page}?shot=${shot}`);
    await new Promise((r) => setTimeout(r, 500));
    const file = `${root}amo/screenshots/screenshot-${shot}.png`;
    await writeFile(file, Buffer.from(await driver.takeScreenshot(), "base64"));
    console.log(`wrote ${file}`);
  }
} finally {
  await driver.quit();
}
