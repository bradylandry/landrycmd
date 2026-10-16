import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

function jpegSize(buf: Buffer): { width: number; height: number } {
  assert.equal(buf[0], 0xff);
  assert.equal(buf[1], 0xd8);
  let i = 2;
  while (i + 8 < buf.length) {
    if (buf[i] !== 0xff) {
      i += 1;
      continue;
    }
    const marker = buf[i + 1] ?? 0;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd9)) {
      i += 2;
      continue;
    }
    const length = buf.readUInt16BE(i + 2);
    if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
      return {
        height: buf.readUInt16BE(i + 5),
        width: buf.readUInt16BE(i + 7),
      };
    }
    i += 2 + length;
  }
  throw new Error("JPEG has no start-of-frame marker");
}

test("the homepage profile photo is a square JPEG with no EXIF", async () => {
  const photo = await readFile(new URL("./public/brady.jpg", root));
  assert.deepEqual(jpegSize(photo), { width: 480, height: 480 });
  assert.equal(photo.includes(Buffer.from("Exif\0\0")), false);
  assert.equal(photo.includes(Buffer.from("http://ns.adobe.com/xap/1.0/")), false);
  assert.equal(photo.includes(Buffer.from("iPhone")), false);
});

test("the homepage opens with the profile intro and the existing lab sections", async () => {
  const home = await readFile(new URL("./src/pages/index.astro", root), "utf8");
  const profile = home.slice(home.indexOf('class="profile"'), home.indexOf('class="hero hero-net"'));
  const text = profile.replace(/\s+/g, " ");
  assert.ok(profile.length > 0);
  assert.match(profile, /src="\/brady\.jpg"/);
  assert.match(profile, /width="480"/);
  assert.match(profile, /height="480"/);
  assert.match(profile, /alt="Portrait of Brady Landry"/);
  assert.match(profile, /<h1 id="profile-name">Brady Landry<\/h1>/);
  assert.match(profile, /Network Architect · AI Automation/);
  assert.match(
    text,
    /I have spent about 15 years building and running service-provider networks at Cox, now Charter\/Spectrum\./,
  );
  assert.match(profile, /href="\/resume"/);
  assert.match(profile, /href="https:\/\/github\.com\/bradylandry"/);
  assert.match(profile, /href="https:\/\/www\.linkedin\.com\/in\/bradylandry\/"/);
  assert.match(profile, /href="mailto:bjlandry@gmail\.com"/);
  assert.match(home, /id="about"/);
  assert.match(home, /id="lab"/);
  assert.match(home, /class="lab-grid"/);
});

test("personal projects stay after the shipped apps and skip private trading links", async () => {
  const home = await readFile(new URL("./src/pages/index.astro", root), "utf8");
  const also = home.slice(home.indexOf("const shipped"), home.indexOf("const openSource"));
  const names = [...also.matchAll(/name: "([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(names, ["ACT Prep", "PeptideTracker", "Jarvis Quant", "Liftbook"]);
  assert.match(also, /A personal stock-research tool\./);
  assert.match(also, /https:\/\/github\.com\/bradylandry\/jarvis-trading-mcp/);
  assert.match(also, /Workout logging that works offline\./);
  assert.equal(also.includes("trading.landrycmd.com"), false);
  assert.equal(/tailscale|azurecontainerapps|jarvis-lab/i.test(also), false);
  assert.equal(/\b(P&L|balance|account number)/i.test(also), false);
});
