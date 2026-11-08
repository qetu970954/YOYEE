# YOYEE — Your Own Yocto & Embedded Education

A local learning site for four Bootlin training courses, in this order:

1. [Embedded Linux system development](https://bootlin.com/training/embedded-linux/)
2. [Linux kernel driver development](https://bootlin.com/training/kernel/)
3. [Yocto Project and OpenEmbedded](https://bootlin.com/training/yocto/)
4. [Linux debugging, tracing, profiling and performance](https://bootlin.com/training/debugging/)

The left sidebar links directly to each course. The learning path follows the chapter boundaries extracted from the original slides. Open a section to read its own PDF in the browser. Selecting Next section marks the current section complete before moving on; you can also change completion manually. The viewer's page numbers start at 1; the course list shows the original slide ranges.

## Start

Install Node.js, then run:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Stop the server with Ctrl+C. The slides and site are local; an internet connection is not required for reading. External references and software downloads require a connection.

Section completion is stored in the current browser's local storage, under `ldd-slide-progress-v1`. Tabs on the same site address share updates; progress is not synchronized across browsers or computers, and clearing browser data can erase it. Saving and resetting require browser support for Web Locks. Settings can reset slide progress after a typed confirmation. Completion is a reading mark, not proof that an exercise passed.

## Slide sources and extraction

The original PDFs are in `materials/bootlin/`. They were published by Bootlin, state an update date of November 8, 2026, and identify **Creative Commons Attribution-ShareAlike 3.0** as their license. Each PDF retains its original attribution and any third-party notices. See [Bootlin's document license](https://bootlin.com/docs/) and the [CC BY-SA 3.0 license](https://creativecommons.org/licenses/by-sa/3.0/).

| Course | Source PDF | Local PDF |
| --- | --- | --- |
| Embedded Linux | [Slides](https://bootlin.com/doc/training/embedded-linux/embedded-linux-slides.pdf) | `materials/bootlin/embedded-linux-slides.pdf` |
| Kernel drivers | [Slides](https://bootlin.com/doc/training/linux-kernel/linux-kernel-slides.pdf) | `materials/bootlin/linux-kernel-slides.pdf` |
| Yocto | [Slides](https://bootlin.com/doc/training/yocto/yocto-slides.pdf) | `materials/bootlin/yocto-slides.pdf` |
| Debugging | [Slides](https://bootlin.com/doc/training/debugging/debugging-slides.pdf) | `materials/bootlin/debugging-slides.pdf` |

To regenerate the section index, install `pdftotext` from Poppler or Xpdf and run:

```sh
node scripts/extract-slides.cjs
```

The script extracts text to identify chapter-divider pages, validates the pinned PDF hashes and page counts, and writes `slides.json`. The page ranges are tied to these exact snapshots. Updating a PDF requires reviewing its version, license and chapter boundaries before updating the script's hash and page count. Automatic extraction depends on the slide divider format; review the generated titles and ranges after any update.

To regenerate the section PDFs on Ubuntu, create a Python environment and install the splitting dependency:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
.venv/bin/python scripts/split-slides.py
```

The split files are stored in `materials/bootlin/sections/<course>/`. Each contains the original pages for its section, with Bootlin attribution, the source URL, license and extracted page range in its metadata. The source PDFs remain unchanged. The site needs neither Python nor `pdftotext` to serve the already-generated files.

Run `npm test` for the index, server and browser checks. The browser check is skipped when Microsoft Edge is not available.

## Practical work

The intended target is a BeagleBone Black Rev C, with native Ubuntu 24.04 as the development host. The slide decks are reference materials, not verification that their examples have been executed here. Bootlin's debugging course lists lab materials for STM32MP1 and BeaglePlay, not a BBB-specific manual. Adaptations require separate verification.

Before wiring, changing boot settings or writing media, identify the hardware, check voltage compatibility and establish a recovery path. In particular, the LCD backpack and its I²C pull-up voltage are not yet identified. Never connect an unverified 5 V signal to BBB 3.3 V I/O.
