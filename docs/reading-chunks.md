# Balanced reading chunks

Status: accepted and implemented for the pinned slide snapshots; reading-time estimates remain editorial, not empirically measured.

## Goal and scope

Replace the site's uneven source-chapter sections, currently ranging from 2 to 87 slides, with coherent reading chunks of approximately **25 minutes of general reading**.

Apply this to all four slide courses, in their existing order:

1. Embedded Linux system development
2. Linux kernel driver development
3. Yocto Project and OpenEmbedded
4. Linux debugging, tracing, profiling and performance

Lab manuals and their organization are unchanged. See [the glossary](../GLOSSARY.md) for the distinction between a source chapter and a reading chunk.

## Reading time

- Target approximately **25 minutes** per chunk; ordinarily aim for **20–30 minutes**.
- Include reading and understanding prose, diagrams, code and worked examples.
- Exclude performing labs, installing tools, waiting for builds and troubleshooting the practical setup.
- Use a general reading-time estimate, not an individual learner profile or an expert presentation pace.
- Evaluate the content, not just slide count. Equal page counts or a fixed number of minutes per slide do not satisfy this requirement.
- Document the estimation assumptions used during implementation. All durations are approximate, not measured or guaranteed study times.

### Implemented estimation method

`scripts/reading-plan.json` records each reviewed start slide, source-text anchor, title, additional interpretation allowance (`reviewMinutes`) and explanation of the material kept together. The generator calculates:

`estimated minutes = round(content words / 180 + reviewMinutes)`, with a minimum of one minute.

The word count omits repeating Bootlin footer/banner lines and standalone bullet symbols. The allowance is not a per-slide multiplier: it covers following the specific diagrams, code, command output and worked examples described in each entry's review. For example, the five ARM boot-flow diagrams and the Device Tree/code walkthroughs need interpretation that their sparse text alone does not represent. Reading lab-objective slides is included; executing the labs, following external resources and waiting for tools are not.

The plan was reviewed against all four slide-title/subtopic sequences and the examples around the selected boundaries. Numbered continuations and repeated-title examples must stay together. The generator checks source anchors, continuation boundaries, coverage and explained timing exceptions. These checks support, but do not replace, reviewing the meaning of the material when the pinned sources change.

| Course | Reading chunks | Estimated minutes per chunk |
| --- | ---: | --- |
| Embedded Linux | 19 | 20–29, except the three short topics below |
| Kernel drivers | 17 | 20–28 |
| Yocto | 11 | 20–26, except the two short topics below |
| Debugging | 15 | 20–28 |

There are **62 chunks**, **57** in the 20–30 minute band. The five intentional exceptions are:

| Course and original slides | Estimate | Why not pad or merge it? |
| --- | ---: | --- |
| Embedded Linux 372–387: raw flash | 17 min | A complete raw-flash topic; adjoining full topics would be oversized or unrelated. |
| Embedded Linux 452–471: license compliance | 16 min | Keep the complete legal/compliance discussion separate from the technical software-stack survey. |
| Embedded Linux 543–552: final resources/notices and connectivity diagram | 6 min | This is the original end-of-course wrap-up, not another full technical lesson. |
| Yocto 163–181: layers | 19 min | Finish the complete layer-creation workflow; either neighboring full topic would make an oversized chunk. |
| Yocto 271–282: licensing/SBoM | 11 min | A compact, complete compliance topic, distinct from SDK/application development. |

## Boundaries, grouping and names

- Preserve every source slide exactly once and in its original order. Do not rewrite the original PDFs or remove attribution, licensing or third-party notices.
- End chunks at complete subtopics or worked examples. Do not cut a multi-slide explanation, code walkthrough or demonstration simply to hit the time target.
- A chunk does not have to finish an entire source chapter.
- Split long chapters at sensible subtopic boundaries. Retain the source chapter title with suffixes such as **Part 1**, **Part 2**, etc., in reading order.
- Group short topics only when they are adjacent and reasonably related. Give the combined chunk a clear descriptive title.
- Do not reorder or combine unrelated material merely to reach 25 minutes.
- Topic completeness takes priority over duration. Shorter or longer exceptions are acceptable when no sensible grouping or stopping point exists; substantial overruns should be split where coherent subtopic boundaries permit. Record the reason for exceptions when reviewing the resulting plan.

## User interface

- Show each chunk's estimated reading time alongside its original slide range, clearly identified as approximate.
- Present the new names and grouping consistently in course lists, the next-learning suggestion and the PDF viewer.
- Keep course navigation, previous/next navigation, completion controls, Labs access and full-screen viewing working.
- Reading time excludes practical lab work; reading a lab manual still does not affect slide completion.

## Existing progress

Existing completion marks refer to old sections. They must not be blindly attached to new chunks merely because start pages happen to match.

- Preserve the original saved progress data rather than clearing or overwriting it destructively.
- Treat the slides of each completed old section as already read.
- Mark a new chunk complete only if **all** its slides were covered by completed old sections.
- Leave a partially covered new chunk incomplete; never mark unread slides complete automatically.
- If a completed old section is split, all new chunks wholly covered by that section remain complete.
- If completed and unread old material is combined, the combined chunk remains incomplete, with the original progress data retained.
- The number and percentage of completed sections may change because the learning units have changed. Completion remains a self-reported reading mark, not proof of a passed exercise.

### Storage implementation

The original `ldd-slide-progress-v1` object remains untouched. With no current record, the site derives complete chunks from that object's original chapter coverage using the extracted `chapters` in `slides.json`. Opening the site alone does not write or remove progress. The first successful save records the imported marks in `ldd-reading-progress-v2`, with keys such as `embedded-linux:86-124`; both endpoints matter, so a matching start alone cannot credit a changed range. Subsequent writes and cross-tab updates use v2 under a Web Lock.

A confirmed reset writes `{}` to v2 instead of removing it, preventing the old backup from being imported again. It leaves the legacy backup and unrelated browser data intact. Older site tabs using v1 are not merged after a v2 record exists; refresh old tabs when upgrading. The specified carry-over is from the original chapter index to this reviewed plan, not an automatic rebalancer for arbitrary future plans.

## Generation and verification

- Implement boundary changes through `scripts/extract-slides.cjs` and the associated generation workflow; do not hand-edit generated `slides.json` ranges.
- Keep the pinned source PDF hashes and page counts unchanged. Regenerate section PDFs from those sources using `scripts/split-slides.py`.
- Review the content and stopping points across all four decks, including introductions, resources and supplementary slides.
- Check complete, contiguous coverage without gaps or duplication, correct extracted page counts, meaningful titles and estimates, and documented timing exceptions.
- Test progress carry-over for split, merged, partially covered and unchanged ranges, including preservation of original stored data.
- Test that server routes, PDF viewing, navigation, completion updates and full-screen behavior still work with the generated chunks.
- Update the README statements that currently promise source-chapter boundaries when the new behavior is implemented.

## Constraints and non-goals

Follow the accepted decisions in [ADR 0001](adr/0001-local-course-and-browser-storage.md) and [ADR 0003](adr/0003-four-slide-courses.md): remain local/offline, preserve browser data and retain Bootlin attribution and license notices.

This work does not add personalized pacing, learning timers, lab verification, new lab adaptations, accounts or synchronization. The final chunk count and boundaries are outputs of content review, not predetermined requirements.
