# YOYEE — Your Own Yocto & Embedded Education

A local learning site for four Bootlin training courses, in this order:

1. [Embedded Linux system development](https://bootlin.com/training/embedded-linux/)
2. [Linux kernel driver development](https://bootlin.com/training/kernel/)
3. [Yocto Project and OpenEmbedded](https://bootlin.com/training/yocto/)
4. [Linux debugging, tracing, profiling and performance](https://bootlin.com/training/debugging/)

The left sidebar links directly to each course and a separate **Labs** tab with the four practical manuals. The learning path uses topic-complete reading chunks targeting about **25 minutes**, usually 20–30 minutes. Long chapters use numbered parts; related short topics are grouped. Estimates include reading diagrams and code, not performing labs. Short standalone topics and end-of-course wrap-ups remain shorter where that makes more sense. Open a section to read its own PDF in the browser. Selecting Next section marks the current section complete before moving on; you can also change completion manually. The viewer's page numbers start at 1; the course list shows the original slide ranges. Both slide and lab viewers have a **Full screen** button inside their bottom-right corner (Esc to exit), where the browser supports the Fullscreen API. This is a site overlay; the browser's built-in PDF toolbar cannot be customized. Reading labs does not change slide progress.

## Start

Install Node.js, then run:

```sh
npm start
```

Open [http://localhost:3000](http://localhost:3000). Stop the server with Ctrl+C. The slides, lab PDFs and site are local; an internet connection is not required for reading. External references and software downloads require a connection.

Section completion is stored in the current browser's local storage, under `ldd-reading-progress-v2`, using original slide ranges as identifiers. Existing `ldd-slide-progress-v1` data is retained unchanged as a backup: until the first v2 save, a chunk is considered complete only if every slide was covered by completed old sections. The first save persists those imported marks alongside your change. A partially covered combined chunk stays incomplete, so completion counts and percentages may change. Resetting after typed confirmation writes an empty v2 record; it does not erase or re-import the legacy backup. Tabs on the same site address share updates; progress is not synchronized across browsers or computers, and clearing browser data can erase it. Saving and resetting require browser support for Web Locks. Completion is a reading mark, not proof that an exercise passed.

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

The script validates the pinned PDF hashes/page counts, extracts original chapter boundaries for progress carry-over, and applies the content-reviewed boundaries in `scripts/reading-plan.json` to generate `slides.json`. Do not edit the generated ranges directly. Reading estimates combine text at 180 words/minute (excluding repeated footers) with explicit, topic-specific allowances for interpreting diagrams, code and examples. They are editorial estimates, not measured study durations. See [the agreed reading-chunk requirements and timing exceptions](docs/reading-chunks.md). Use `node scripts/extract-slides.cjs --check` to verify that the index is up to date without writing it.

The ranges and reviewed anchors are tied to these exact snapshots. Updating a PDF requires reviewing its version, license, chapter extraction, complete examples and all planned cut points before updating the script's hash/page count and reading plan. Old `#slide/<course>/<page>` links still open the chunk containing that original slide.

To regenerate the section PDFs on Ubuntu, create a Python environment and install the splitting dependency:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r scripts/requirements.txt
.venv/bin/python scripts/split-slides.py
```

The split files are stored in `materials/bootlin/sections/<course>/`. Each contains the original pages for its reading chunk, with Bootlin attribution, the source URL, license and extracted page range in its metadata. After successfully splitting each course, the script removes obsolete numeric range PDFs from that course's generated directory; other filenames are left alone. The source PDFs and lab manuals remain unchanged. The site needs neither Python nor `pdftotext` to serve the already-generated files. Restart the Node server after regenerating the index/PDFs so its route allowlist uses the new ranges.

Run `npm test` for the index, server and browser checks. The browser check uses an installed Chrome/Edge, or the executable at `BROWSER_PATH`; it is skipped when none is available.

## Lab manual sources

The unmodified lab PDFs are stored alongside the slide decks in `materials/bootlin/`. These Bootlin snapshots are dated **November 11, 2026**, retain their original attribution and third-party notices, and identify **CC BY-SA 3.0** as their license. Source URLs, board variants, page counts and SHA-256 hashes are pinned in `labs.json`; tests check that the local files match. These manuals are newer than the November 8 slide snapshots, so exercise details may differ.

| Course | Source PDF | Local PDF |
| --- | --- | --- |
| Embedded Linux | [BBB labs](https://bootlin.com/doc/training/embedded-linux/embedded-linux-bbb-labs.pdf) | `materials/bootlin/embedded-linux-bbb-labs.pdf` |
| Kernel drivers | [BBB labs](https://bootlin.com/doc/training/linux-kernel/linux-kernel-bbb-labs.pdf) | `materials/bootlin/linux-kernel-bbb-labs.pdf` |
| Yocto | [BBB labs](https://bootlin.com/doc/training/yocto/yocto-bbb-labs.pdf) | `materials/bootlin/yocto-bbb-labs.pdf` |
| Debugging | [BeaglePlay labs](https://bootlin.com/doc/training/debugging/debugging-beagleplay-labs.pdf) | `materials/bootlin/debugging-beagleplay-labs.pdf` |

Bootlin does not publish a BBB debugging manual. The Labs tab explicitly labels the included BeaglePlay manual; it is not a BBB-validated substitute. Only the manuals are bundled, not the lab-data archives, toolchains or exercise dependencies. To update a manual, review its board, date and license before replacing the PDF and updating `labs.json`.

## Practical work

The intended target is a BeagleBone Black Rev C, with native Ubuntu 24.04 as the development host. The slide decks are reference materials, not verification that their examples have been executed here. Bootlin's debugging course lists lab materials for STM32MP1 and BeaglePlay, not a BBB-specific manual. Adaptations require separate verification.

Before wiring, changing boot settings or writing media, identify the hardware, check voltage compatibility and establish a recovery path. In particular, the LCD backpack and its I²C pull-up voltage are not yet identified. Never connect an unverified 5 V signal to BBB 3.3 V I/O.


------------------------------------------------------------------------------------------------------------------
- 20261110: Complete course 1, section 1. Many terms. eMMC/SPI/etc....General idea okay. Still need get familier to these terms.
- 20261111: Complete course 1, section 2. Have lab that use `crosstool-ng` to build my own compile tool chain on my HOST.

