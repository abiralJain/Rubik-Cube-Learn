# Opal reference sheet

Measured from Opal's current iOS build (Mobbin, September 2026): home, onboarding, timer, gem detail, rewards list, session sheet. Values are in points on a 390-wide screen. Where Opal follows Apple's system type sizes, the HIG size is used. This sheet is the source of truth for Cube's skin; nothing below is interpreted.

## Ground and light

| Element | Opal | Cube |
| --- | --- | --- |
| Screen ground | `#000` with a dark rock/cave photograph behind the hero | `#000` with a soft radial room (no photograph) |
| Hero glow | Mint radial glow under and behind the gem, ~60% of screen width, fades to black by mid-screen | Same geometry, tinted by the current stage colour |
| Pedestal | Small black puck the gem sits on, soft shadow | The cube's own ground shadow, deepened for black |
| Accent | Mint `#9BEBC0` for data words, small-caps labels, breadcrumb, icons | The current stage colour at the same roles |

## Type (SF Pro on Apple, Inter elsewhere)

| Role | Size / weight | Colour | Notes |
| --- | --- | --- | --- |
| Wordmark | 28 semibold, -0.02em | white | top-left |
| Screen sentence (onboarding) | 22/28 semibold, -0.01em | white | centred, two lines max |
| Detail title (gem name) | 20 semibold | white | centred |
| Card / section title | 17 semibold | white | left |
| Body | 15/20 regular | white 60% | |
| Hero number | 40 semibold, tabular | white | "81 ▲" |
| Ruler value | 24 semibold | white | centre of the scrubber |
| Chip | 15 medium | white | |
| Row label | 15 medium | white | |
| Caption | 13 regular | white 60% | "Owned by 98%", "3h 30m You" |
| Small caps | 11 semibold, +0.08em, uppercase | white 60% or accent | "SCORE", "DAY STREAK", "TAP TO CONTINUE" (13 semibold, accent) |
| Tab label | 11 medium | white 60%, active white | |

## Controls

| Control | Size | Style |
| --- | --- | --- |
| Primary pill | 52 tall, full width, radius 26 | Base `#2A2A2C`; a soft light sheen along the bottom edge, pale yellow at left fading to mint at right, ~35% opacity, blurred; label 16 semibold white |
| Primary pill (legacy home) | 56 tall | Solid yellow→cyan gradient, black label. Not used by Cube |
| Secondary pill | 52 tall | `#1C1C1E`, label 16 medium white |
| Disabled pill | 52 tall | `#1C1C1E`, label white 40%, check icon ("Current Gem") |
| Hold pill | 52 tall | Same as primary; fills left→right over ~1.2 s while pressed, snaps back in 200 ms on release |
| Option row (single choice) | 52 tall, radius 16, 8 gap | `rgba(255,255,255,.08)`; icon 18 accent at left, label 15 medium; 20 side padding |
| Chip | 36 tall, radius 18, 8 gap | `rgba(255,255,255,.12)`; 15 medium; selected chip white 20% |
| Stat pill (outlined) | 40 tall, radius 20 | 1px accent stroke; icon + number 17 semibold; label 13 below |
| Icon button | 36 circle | `rgba(255,255,255,.12)`; icon 16 white |
| Stepper | 44 circles either side of a 52 value pill | minus / value / plus |
| Ruler scrubber | 56 tall card, radius 16 | Tick marks 1px white 30% every 4 pt, tall tick at centre, value 24 semibold centred, neighbours 13 at 40% |
| Segmented progress | 3 tall, 6 gap | white 20% track, white fill for done, current partially filled |
| Progress hairline | 4 tall, radius 2 | white 12% track, accent fill; caption "5/30 days" centred below |
| Tab bar | 64 tall floating pill, 24 from bottom, 20 side inset | `rgba(30,30,32,.85)` + blur 20; three items icon 22 + label 11; active item sits in a 48 circle white 12% |
| Card | radius 24, 18 padding | `rgba(255,255,255,.06)`; breadcrumb 13 accent "Sleep / Last Pickup"; title 17 semibold; body 15 60%; CTA pill inside, 14 gap |
| Sheet | radius 28 top, 20 padding | `#161618` + blur; grabber 36×5 white 30%; close circle top-left |
| Social proof chip | 28 tall | Outlined accent 1px, icon + "Owned by 95%" 13 medium |

## Layout

- Safe top 54, nav row 44, content starts at 118.
- Hero occupies the upper third: gem centre at ~30% of height, glow radius ~45% of width.
- One thought per screen: one sentence, one primary action. Secondary actions are text links.
- Text is centred on hero screens and left-aligned inside cards and lists.
- Side padding 20. Card gap 12. Row gap 8.

## Interactions

| Moment | Behaviour |
| --- | --- |
| Tap to continue | Whole screen is the target; small-caps label pulses gently |
| Hold to start / commit | Pill fills left→right while pressed; release early snaps back; completion pops the label 1.02× |
| Duration | Chips for presets, ruler scrub for fine value, stepper on the sheet |
| Countdown | Full-screen blurred photo, "3 2 1" 96 light |
| Gem unlock | Gem detail screen: title, subtitle, social proof chip, gem on pedestal, "Unlocked on …", CTA "Apply Theme" |
| Gem locked | Same screen, grey stone, hairline progress "5/30 days", CTA disabled "Locked" |
| Value change | Text pop: number scales 1→1.06→1 over 240 ms while it changes |
| Streak | Flame icon + count top-right |

## Cube mapping

| Opal | Cube |
| --- | --- |
| Gem on pedestal | Cut-stone enamel cube on its shadow |
| Score 81 ▲ | Stage 3 of 7 (Home) |
| Stat pills Sleep / Focus / Rest | Stage / Moves / Time |
| Session card + CTA | "Keep going" card + Continue |
| Duration ruler | Algorithm ruler: moves as ticks, current move 24 semibold at centre |
| Chips ∞ 15m 30m 1h | Notation chips in the sheet only |
| Hold to Start | Hold to skip a stage / Hold to start over |
| Gem detail (unlocked) | Stage complete: stage gem, "Unlocked <date>", Continue |
| Gem detail (locked) | Stage preview from the journey |
| Tab bar Home / My Apps / Timer | Home / Cube / Learn |
| TAP TO CONTINUE | TURN THE CUBE (Learn hint when the arrow is showing) |

## The cube as an Opal object

| Part | Value | Why |
| --- | --- | --- |
| Tile geometry | Square extruded 0.04 with a two-ring chamfer (thickness 0.11, inset 0.13), flat shaded | Sharp facets catch the studio lights like a cut stone; rounded pillows read as candy |
| Tile placement | Centre 0.59 from the cubelet centre; table 0.22 proud of the body | The body shows only as bright black seams |
| Tile material | roughness 0.04, clearcoat 1 (roughness 0.02), ior 2.0, iridescence 0.2, env 1.0 | Enamel over pigment, a little thin-film fire in the highlights |
| Colours | `#EDEDE8` `#E9A90A` `#C8231F` `#E0640C` `#128F4E` `#1F4FC2` | Deep pigments stay saturated under hard light |
| Body | `#0A0A0C`, roughness 0.08, clearcoat 1, radius 0.06 | Opal's black pedestal |
| Environment | Code-built studio: 0.32 grey tent, warm key softbox front-left, cool strip right, strip above the camera, dim floor | Small hard lights on black make facets read as facets; the default room floods tiles pastel |
| Lights | Directional 0.85 / 0.25 / 0.55 neutral, hemisphere 0.15, exposure 1.05 | Shape only; the environment lights |
| Dimmed tile | Pigment ×0.3 in linear light, roughness 0.6, env 0.18, iridescence 0 | In shadow, not dirty |
| Arrow | White, tube 0.075, lifted by tile height + 0.18 | Reads on any tile |
| Solved | Iridescence and env rise with the bloom, then relax | The stone catches fire once |
