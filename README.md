# YOYEE — Your Own Yocto & Embedded Education

## Study progress

New stuff goes on top. What I did. Where I got stuck. What’s next. Link notes and screenshots here. No auto-updates.

**Format:** `YYYYMMDD: Do the thing`

- 20261120: Read Course 1, sections 5–6. Linux kernel, init, root filesystem. Next up: BusyBox lab.
- 20261116: U-Boot lab done. Set up U-Boot for the BeagleBone Black. Boot ROM → MLO/SPL → `u-boot.img`. Used TFTP.
- 20261115: Read Course 1, sections 3–4. U-Boot, ARM exception levels (EL0–EL3), TF-A/ATF. Got stuck setting up the boot microSD card.
- 20261111: Read Course 1, section 2. How to build a cross-toolchain on my PC with `crosstool-NG`.
- 20261110: Read Course 1, section 1. Big picture makes sense. Still fuzzy on eMMC and SPI.

## Quick start

Install Node.js. Run `npm start` in this folder. Open [localhost:3000](http://localhost:3000).

Four Bootlin courses. About 25 min per section. Slides and lab PDFs work offline. Find the manuals in **Labs**.

**Next section** marks this one done. Lab PDFs don’t count. Progress stays in this browser. Clear site data? Progress gone. Save or reset needs Web Locks.

## Course materials

[PDFs](materials/bootlin/) from [Bootlin](https://bootlin.com/docs/). License: [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/). Slides: Nov 8, 2026. [Lab manuals](labs.json): Nov 11, 2026.

1. [Embedded Linux](https://bootlin.com/doc/training/embedded-linux/embedded-linux-slides.pdf)
2. [Linux kernel drivers](https://bootlin.com/doc/training/linux-kernel/linux-kernel-slides.pdf)
3. [Yocto](https://bootlin.com/doc/training/yocto/yocto-slides.pdf)
4. [Linux debugging](https://bootlin.com/doc/training/debugging/debugging-slides.pdf)

Lab setup: BeagleBone Black Rev C + Ubuntu 24.04. Debugging manual: for BeaglePlay. Not tested here on BeagleBone Black.

Before touching hardware: check the board model, voltage limits, and recovery steps. No 5 V straight into 3.3 V I/O.

## Update the slides

1. Want different section breaks? Edit the [reading plan](scripts/reading-plan.json), not the index. See [how we split the slides](docs/reading-chunks.md).
2. Install `pdftotext`. Run `node scripts/extract-slides.cjs` to rebuild the index.
3. In a Python virtual environment, run `pip install -r scripts/requirements.txt`, then `python scripts/split-slides.py`. Restart the server.
4. Run `npm test`. Browser not found? Set `BROWSER_PATH` to a supported browser’s executable.
