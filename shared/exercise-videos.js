import { exerciseByName } from "./exercises.js";
// Public demonstrations matched to catalog exercises using indexed titles and source descriptions.
// Per-account choices take priority. YouTube controls availability and embedding permissions.
export const exerciseVideos = {
  "back-squat": {
    url: "https://www.youtube.com/watch?v=ultWZbUMPL8",
    title: "The Back Squat",
    creator: "CrossFit · James Hobart",
    source: "https://www.bing.com/search?format=rss&q=%22back%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "front-squat": {
    url: "https://www.youtube.com/watch?v=revE4okQS6c",
    title: "HOW TO FRONT SQUAT | Coach Kelly Cues",
    creator: "Coach Kelly Cues",
    source: "https://www.bing.com/search?format=rss&q=%22front%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "romanian-deadlift": {
    url: "https://www.youtube.com/watch?v=lHFoDe0MO5k",
    title:
      "How To: Barbell Romanian Deadlift #rdl #romaniandeadlift #howtordl #deadlifttips",
    creator: "Tone with Tati",
    source: "https://www.bing.com/videos/search?q=%22barbell%20rdl%22",
    reviewedAt: "2026-10-28",
  },
  "conventional-deadlift": {
    url: "https://www.youtube.com/watch?v=ZaTM37cfiDs",
    title: "How To Deadlift With Perfect Technique (Step By Step)",
    creator: "Jeff Nippard",
    source: "https://www.bing.com/videos/search?q=%22deadlift%22",
    reviewedAt: "2026-10-28",
  },
  "sumo-deadlift": {
    url: "https://www.youtube.com/watch?v=wQHSYDSgDn8",
    title: "The Sumo Deadlift",
    creator: "CrossFit · Julie Foucher",
    source: "https://www.bing.com/search?format=rss&q=%22sumo%20deadlift%22",
    reviewedAt: "2026-10-28",
  },
  "barbell-hip-thrust": {
    url: "https://www.youtube.com/watch?v=lnNIQU8T7zE",
    title: "How to Do a Barbell Hip Thrust | Exercise Demo",
    creator: "DEVI Fitness™",
    source: "https://www.bing.com/videos/search?q=%22Barbell%20Thruster%22",
    reviewedAt: "2026-10-28",
  },
  "good-morning": {
    url: "https://www.youtube.com/watch?v=vKPGe8zb2S4",
    title: "How To Perform Good Mornings - Exercise Tutorial",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22good%20morning%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "barbell-lunge": {
    url: "https://www.youtube.com/watch?v=wrwwXE_x-pQ",
    title: "How To Do A LUNGE | Lunges for BEGINNERS",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22lunge%20with%20barbell%22",
    reviewedAt: "2026-10-28",
    note: "General lunge technique demonstration, rather than a barbell-specific tutorial. Follow Buff’s bar placement and setup instructions for the loaded version.",
  },
  "zercher-squat": {
    url: "https://www.youtube.com/watch?v=0JKs2ej_Z-4",
    title: "How To Do The Zercher Squat (Full Body Exercise)",
    creator: "Feldkamp Performance Factory",
    source: "https://www.bing.com/videos/search?q=%22Zercher%20Squat%22",
    reviewedAt: "2026-10-28",
  },
  "goblet-squat": {
    url: "https://www.youtube.com/watch?v=fJM_zwWIRXQ",
    title: "How To Do a Goblet Squat",
    creator: "Peak Functional",
    source: "https://www.bing.com/videos/search?q=%22Goblet%20Squat%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-romanian-deadlift": {
    url: "https://www.youtube.com/watch?v=EQ6n5JpFqzo",
    title: "Romanian Deadlift with Dumbbells [How To]",
    creator: "Le Sweat",
    source:
      "https://www.bing.com/videos/search?q=%22Dumbbell%20Romanian%20Deadlift%22",
    reviewedAt: "2026-10-28",
  },
  "bulgarian-split-squat": {
    url: "https://www.youtube.com/watch?v=VPhhE6bBzZE",
    title: "How To Do Bulgarian Split Squats Correctly",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22bulgarian%20split%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-lunge": {
    url: "https://www.youtube.com/watch?v=_DLIS8SySzs",
    title: "How to PROPERLY Walking Dumbbell Lunge (FIX THIS NOW!)",
    creator: "Colossus Fitness",
    source: "https://www.bing.com/videos/search?q=%22dumbbell%20lunges%22",
    reviewedAt: "2026-10-28",
    note: "This video demonstrates walking dumbbell lunges. For stationary reps, return to your starting stance between forward steps as described in Buff’s instructions.",
  },
  "walking-lunge": {
    url: "https://www.youtube.com/watch?v=EjWw5feJvKw",
    title: "How to do a walking lunge properly",
    creator: "Xtine Cardenas",
    source: "https://www.bing.com/videos/search?q=%22Walking%20Lunge%22",
    reviewedAt: "2026-10-28",
  },
  "reverse-lunge": {
    url: "https://www.youtube.com/watch?v=A4RgIkuHRIY",
    title: "How to Do the Perfect Reverse Lunge",
    creator: "GASP & Better Bodies: THE",
    source: "https://www.bing.com/videos/search?q=%22Reverse%20Lunge%22",
    reviewedAt: "2026-10-28",
  },
  "step-up": {
    url: "https://www.youtube.com/watch?v=dQqApCGd5Ss",
    title: "How to Do Step-Ups",
    creator: "LIVESTRONG",
    source: "https://www.bing.com/videos/search?q=%22step%20ups%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "single-leg-romanian-deadlift": {
    url: "https://www.youtube.com/watch?v=gPnUTh0k0kc",
    title: "How to Do a Single-Leg Romanian Deadlift",
    creator: "Girls Gone Strong | Women's Health & Fitness",
    source:
      "https://www.bing.com/videos/search?q=%22Single-leg%20Romanian%20Deadlift%22",
    reviewedAt: "2026-10-28",
  },
  "leg-press": {
    url: "https://www.youtube.com/watch?v=LiwTxuToQCM",
    title: "How To Use the Leg Press Machine Correctly!",
    creator: "Mixed Fitness Arts",
    source: "https://www.bing.com/videos/search?q=%22Leg%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "hack-squat": {
    url: "https://www.youtube.com/watch?v=0tn5K9NlCfo",
    title: "Hack Squat | Exercise Guide",
    creator: "Bodybuilding.com",
    source: "https://www.bing.com/search?format=rss&q=%22hack%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "leg-extension": {
    url: "https://www.youtube.com/watch?v=SeQnSX63mUQ",
    title:
      "How to Do Leg Extensions Correctly | Gym Guide #shorts #fitness #gym #legs",
    creator: "KC FITNESS",
    source: "https://www.bing.com/videos/search?q=%22Leg%20Extension%22",
    reviewedAt: "2026-10-28",
  },
  "seated-leg-curl": {
    url: "https://www.youtube.com/watch?v=G5iP_YcDQdE",
    title: "How to do a Seated Leg Curl | Proper Form & Technique | NASM",
    creator: "National Academy of Sports Medicine (NASM)",
    source:
      "https://www.bing.com/search?format=rss&q=%22seated%20leg%20curl%22",
    reviewedAt: "2026-10-28",
  },
  "lying-leg-curl": {
    url: "https://www.youtube.com/watch?v=9xY9SN7daGM",
    title:
      "Perfect Lying Leg Curl Form #legexercise #lyingchallenge #legmuscles #boostimmunity #workoutroutine",
    creator: "The Viral Fun",
    source: "https://www.bing.com/videos/search?q=%22leg%20curls%22",
    reviewedAt: "2026-10-28",
  },
  "standing-calf-raise": {
    url: "https://www.youtube.com/watch?v=KRJIKsY02nE",
    title: "Standing Calf Raise Tutorial for Beginners",
    creator: "Strength, Verified",
    source:
      "https://www.bing.com/videos/search?q=%22Standing%20Calf%20Raise%22",
    reviewedAt: "2026-10-28",
  },
  "seated-calf-raise": {
    url: "https://www.youtube.com/watch?v=3ZRe_QpvRPg",
    title: "How To Do A Seated Calf Raise",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22seated%20calf%20raise%22",
    reviewedAt: "2026-10-28",
  },
  "hip-abduction": {
    url: "https://www.youtube.com/watch?v=FqcyDcBkscY",
    title: "How to Perform the Machine Hip Abduction Properly",
    creator: "Idris",
    source: "https://www.bing.com/videos/search?q=%22Hip%20Abduction%22",
    reviewedAt: "2026-10-28",
  },
  "hip-adduction": {
    url: "https://www.youtube.com/watch?v=fFrFuMN2q2Y",
    title: "How to do Hip Adduction",
    creator: "Idris",
    source: "https://www.bing.com/videos/search?q=%22Hip%20Adduction%22",
    reviewedAt: "2026-10-28",
  },
  "smith-machine-squat": {
    url: "https://www.youtube.com/watch?v=jPrzu4kp47o",
    title: "How to Perform the Smith Machine Squat",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22smith%20machine%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "bodyweight-squat": {
    url: "https://www.youtube.com/watch?v=J6XFjEzk-zU",
    title: "Air Squat (Bodyweight Squat Form)",
    creator: "NeuStrength | Personal Trainer",
    source: "https://www.bing.com/videos/search?q=%22air%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "glute-bridge": {
    url: "https://www.youtube.com/watch?v=wPM8icPu6H8",
    title: "How To Do A Glute Bridge | The Right Way | Well+Good",
    creator: "Well+Good · Charlee Atkins",
    source: "https://www.bing.com/search?format=rss&q=%22glute%20bridge%22",
    reviewedAt: "2026-10-28",
  },
  "single-leg-glute-bridge": {
    url: "https://www.youtube.com/watch?v=_K_di6h2-Wg",
    title: "How to do a Single-Leg Glute Bridge | The Right Way",
    creator: "Well+Good · Kat Atienza",
    source:
      "https://www.bing.com/search?format=rss&q=%22single-leg%20glute%20bridge%22",
    reviewedAt: "2026-10-28",
  },
  "nordic-hamstring-curl": {
    url: "https://www.youtube.com/watch?v=_e9vFU9-tkc",
    title: "How to Set Up, Perform, & Program Nordic Hamstring Curls ...",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22nordic%20hamstring%20curl%22",
    reviewedAt: "2026-10-28",
  },
  "pistol-squat": {
    url: "https://www.youtube.com/watch?v=vq5-vdgJc0I",
    title: "How to Get Your First PISTOL SQUAT (Step-by-Step Progression)",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22pistol%20squat%22",
    reviewedAt: "2026-10-28",
  },
  "jump-squat": {
    url: "https://www.youtube.com/watch?v=A-cFYWvaHr0",
    title: "How To Do A Squat Jump | The Right Way | Well+Good",
    creator: "Well+Good · Sashah Handal",
    source: "https://www.bing.com/search?format=rss&q=%22squat%20jumps%22",
    reviewedAt: "2026-10-28",
  },
  "lateral-lunge": {
    url: "https://www.youtube.com/watch?v=D2P1GHkspCo",
    title: "How to Properly Perform a Lateral Lunge (For Beginners)",
    creator: "Janay Mason",
    source: "https://www.bing.com/videos/search?q=%22Lateral%20Lunge%22",
    reviewedAt: "2026-10-28",
  },
  "wall-sit": {
    url: "https://www.youtube.com/watch?v=-cdph8hv0O0",
    title: "Wall Sit",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22wall%20sit%22",
    reviewedAt: "2026-10-28",
  },
  "trap-bar-deadlift": {
    url: "https://www.youtube.com/watch?v=4-czypurzXM",
    title: "How to perform a trap bar deadlift",
    creator: "Human Kinetics",
    source: "https://www.bing.com/videos/search?q=%22Trap%20Bar%20Deadlift%22",
    reviewedAt: "2026-10-28",
  },
  "pull-up": {
    url: "https://www.youtube.com/watch?v=rrLbkcQ2kW4",
    title:
      "How to do your first pull up | Calisthenics for beginners | How to do pull ups | Pull up tutorial",
    creator: "Yuvraj LOY",
    source: "https://www.bing.com/videos/search?q=%22Pull-up%22",
    reviewedAt: "2026-10-28",
  },
  "neutral-grip-pull-up": {
    url: "https://www.youtube.com/watch?v=qnsGg0VZTUA",
    title: "How to Master the Neutral Grip Pull Up",
    creator: "Brent Lee Hill",
    source:
      "https://www.bing.com/videos/search?q=%22Neutral%20Grip%20Pull%20Up%22",
    reviewedAt: "2026-10-28",
  },
  "chin-up": {
    url: "https://www.youtube.com/watch?v=nrrh7j3qUW4",
    title:
      "Chin-Up | Correct Form, Technique & Benefits | Best Bodyweight Exercise for Back & Biceps",
    creator: "Anand Physical Therapy Academy",
    source: "https://www.bing.com/videos/search?q=%22Chin-up%22",
    reviewedAt: "2026-10-28",
  },
  "wide-grip-pull-up": {
    url: "https://www.youtube.com/watch?v=rrLbkcQ2kW4",
    title:
      "How to do your first pull up | Calisthenics for beginners | How to do pull ups | Pull up tutorial",
    creator: "Yuvraj LOY",
    source: "https://www.bing.com/videos/search?q=%22Pull-up%22",
    reviewedAt: "2026-10-28",
    note: "General pull-up technique demonstration. For this variation, use the moderately wider overhand grip described in Buff’s instructions.",
  },
  "assisted-pull-up": {
    url: "https://www.youtube.com/watch?v=I3Tq13KAAZw",
    title: "How to Use the Assisted Dip & Pull-Up for Stronger Reps",
    creator: "Life Fitness Australia",
    source: "https://www.bing.com/videos/search?q=%22Assisted%20Pull-up%22",
    reviewedAt: "2026-10-28",
  },
  "barbell-row": {
    url: "https://www.youtube.com/watch?v=haA8IPUfHWg",
    title:
      "Your Lower Back Shouldn't Hurt During Barbell Bent-Over Rows #backworkout #form #gym",
    creator: "ScottHermanFitness",
    source: "https://www.bing.com/videos/search?q=%22Barbell%20Hip%20Thrust%22",
    reviewedAt: "2026-10-28",
  },
  "pendlay-row": {
    url: "https://www.youtube.com/watch?v=Wv7f0uIKh8o",
    title: "How To Do A Pendlay Row",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22pendlay%20row%22",
    reviewedAt: "2026-10-28",
  },
  "t-bar-row": {
    url: "https://www.youtube.com/watch?v=6wH5XVwBtbo",
    title:
      "How to PROPERLY T-Bar Row For Muscle Gain #backworkout #fitnessjourney #gymmotivation",
    creator: "Colossus Fitness",
    source: "https://www.bing.com/videos/search?q=%22T-bar%20Row%22",
    reviewedAt: "2026-10-28",
  },
  "single-arm-dumbbell-row": {
    url: "https://www.youtube.com/watch?v=geSFJ48VHuA",
    title: "One-Arm Dumbbell Row - Form Demo | Wired 2 Thryve",
    creator: "Wired 2 Thryve",
    source:
      "https://www.bing.com/videos/search?q=%22Single-arm%20Dumbbell%20Row%22",
    reviewedAt: "2026-10-28",
  },
  "chest-supported-dumbbell-row": {
    url: "https://www.youtube.com/watch?v=W-tbnhB8WmM",
    title: "How to perform a two dumbbell chest supported row",
    creator: "Human Kinetics",
    source:
      "https://www.bing.com/videos/search?q=%22Chest-supported%20Dumbbell%20Row%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-pullover": {
    url: "https://www.youtube.com/watch?v=jCV5t9Cy4hI",
    title: "Dumbbell Pullover exercise tutorial",
    creator: "Buff Dudes Workouts",
    source: "https://www.bing.com/videos/search?q=%22Dumbbell%20Pullover%22",
    reviewedAt: "2026-10-28",
  },
  "lat-pulldown": {
    url: "https://www.youtube.com/watch?v=lmatGLlm1qs",
    title: "How to Do Lat Pulldown",
    creator: "Andrew Kwong (DeltaBolic)",
    source: "https://www.bing.com/videos/search?q=%22Lat%20Pulldown%22",
    reviewedAt: "2026-10-28",
  },
  "neutral-grip-lat-pulldown": {
    url: "https://www.youtube.com/watch?v=1PkjtyA8Y-o",
    title:
      "How to Actually Grow Your Lats Wider Fast with Neutral Grip Lat Pulldown #latpulldown #backexercise",
    creator: "Gymbro001 | Workout Form & Muscle Growth",
    source:
      "https://www.bing.com/videos/search?q=%22Neutral%20Grip%20Pull%20Up%22",
    reviewedAt: "2026-10-28",
  },
  "seated-cable-row": {
    url: "https://www.youtube.com/watch?v=cAeBmvpt31A",
    title: "How to Do Seated Cable Rows Correctly",
    creator: "FIT LIFE REGIME",
    source: "https://www.bing.com/videos/search?q=%22Seated%20Cable%20Row%22",
    reviewedAt: "2026-10-28",
  },
  "straight-arm-pulldown": {
    url: "https://www.youtube.com/watch?v=wcVDItawocI",
    title: "Straight Arm Pulldown - Back Exercise - Bodybuilding.com",
    creator: "Bodybuilding.com",
    source:
      "https://www.bing.com/search?format=rss&q=%22straight-arm%20pulldown%22",
    reviewedAt: "2026-10-28",
  },
  "single-arm-cable-row": {
    url: "https://www.youtube.com/watch?v=Y9vk5jBXx5s",
    title: "How to do Single arm cable row",
    creator: "Idris",
    source: "https://www.bing.com/videos/search?q=%22Seated%20Cable%20Row%22",
    reviewedAt: "2026-10-28",
  },
  "machine-row": {
    url: "https://www.youtube.com/watch?v=fNu-Uji_jbY",
    title:
      "How to Use the TRUE Fitness Palladium Series Seated Row | Proper Setup & Form",
    creator: "Final Round Training",
    source: "https://www.bing.com/videos/search?q=%22seated%20row%22",
    reviewedAt: "2026-10-28",
  },
  "back-extension": {
    url: "https://www.youtube.com/watch?v=pG-FgECu6vA",
    title: "Back Extension Machine | Proper Form & Technique | A’S Gym",
    creator: "Coach089 | A´S Gym",
    source: "https://www.bing.com/videos/search?q=%22Back%20Extension%22",
    reviewedAt: "2026-10-28",
  },
  "band-pull-apart": {
    url: "https://www.youtube.com/watch?v=911JxRL-Tcs",
    title:
      "Band Pull-Apart – How to Perform It Correctly | Trevor Kashey Nutrition (TKN Movement Library)",
    creator: "Trevor Kashey Nutrition",
    source: "https://www.bing.com/videos/search?q=%22Band%20Pull-apart%22",
    reviewedAt: "2026-10-28",
  },
  "band-row": {
    url: "https://www.youtube.com/watch?v=WkNuYbWZ8g8",
    title:
      "Beginner Resistance Band Rows Exercise - How To Do Resistance Band Row ...",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22band%20rows%22",
    reviewedAt: "2026-10-28",
  },
  "barbell-bench-press": {
    url: "https://www.youtube.com/watch?v=JvOJdUtx6UQ",
    title: "How to BENCH PRESS with Good Form - Quick and Easy Technique Fix",
    creator: "megsquats",
    source:
      "https://www.bing.com/videos/search?q=%22Dumbbell%20Bench%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "incline-barbell-bench-press": {
    url: "https://www.youtube.com/watch?v=2rBfrIvMZb0",
    title: "How to Incline Barbell Bench Press",
    creator: "Drevrxfit",
    source:
      "https://www.bing.com/videos/search?q=%22Barbell%20Bench%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "decline-barbell-bench-press": {
    url: "https://www.youtube.com/watch?v=Legiys04HG0",
    title: "Decline Bench Press: AVOID SHOULDER INJURY.😤",
    creator: "mountaindog1",
    source: "https://www.bing.com/videos/search?q=%22decline%20bench%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-bench-press": {
    url: "https://www.youtube.com/watch?v=4_QuyfOCI5U",
    title: "How to do a Dumbbell Bench Press",
    creator: "National Academy of Sports Medicine (NASM)",
    source:
      "https://www.bing.com/videos/search?q=%22Dumbbell%20Bench%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "incline-dumbbell-bench-press": {
    url: "https://www.youtube.com/watch?v=oRz7TJpU3KA",
    title: "Incline Dumbbell Bench Press | Step-by-Step Exercise Guide",
    creator: "GYM LIFE MOTIVATION",
    source:
      "https://www.bing.com/videos/search?q=%22incline%20dumbbell%20press%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-fly": {
    url: "https://www.youtube.com/watch?v=6jYsFXx2bvw",
    title:
      "The only way to do Dumbbell Flys correctly ✅ #chestworkout #gymtips #shorts",
    creator: "GymX Pro",
    source: "https://www.bing.com/videos/search?q=%22Dumbbell%20Fly%22",
    reviewedAt: "2026-10-28",
  },
  "incline-dumbbell-fly": {
    url: "https://www.youtube.com/watch?v=L1MsRiO674w",
    title: "How to perform an incline dumbbell fly",
    creator: "Human Kinetics",
    source: "https://www.bing.com/videos/search?q=%22incline%20fly%22",
    reviewedAt: "2026-10-28",
  },
  "cable-fly": {
    url: "https://www.youtube.com/watch?v=PRw7ieDBLl4",
    title: "STANDING CABLE FLY",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22cable%20fly%22",
    reviewedAt: "2026-10-28",
  },
  "low-to-high-cable-fly": {
    url: "https://www.youtube.com/watch?v=eQ_NBB6OBH4",
    title:
      'HOW TO: Chest "Low-To-High" Cable Fly (BIGGER UPPER CHEST) || PERFECT FORM',
    creator: "ScottHermanFitness",
    source:
      "https://www.bing.com/videos/search?q=%22Low-to-high%20Cable%20Fly%22",
    reviewedAt: "2026-10-28",
  },
  "push-up": {
    url: "https://www.youtube.com/watch?v=UBSR9UHfVbc",
    title: "How to Do a Perfect Push-Up (Step-by-Step) 👍🏻 #shorts",
    creator: "Kareem Fitness",
    source: "https://www.bing.com/videos/search?q=%22Push-up%22",
    reviewedAt: "2026-10-28",
  },
  "incline-push-up": {
    url: "https://www.youtube.com/watch?v=wfklYv7GDxU",
    title:
      "Incline Push-Up | Correct Form, Technique | Best Beginner Chest Exercise | Lower Chest Workout",
    creator: "Anand Physical Therapy Academy",
    source:
      "https://www.bing.com/videos/search?q=%22Incline%20Barbell%20Bench%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "decline-push-up": {
    url: "https://www.youtube.com/watch?v=QBlYp-EwHlo",
    title: "How To Do A Decline Push Up",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22decline%20pushup%22",
    reviewedAt: "2026-10-28",
  },
  "diamond-push-up": {
    url: "https://www.youtube.com/watch?v=J0DnG1_S92I",
    title: "How To: Diamond Push-Up",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22diamond%20pushup%22",
    reviewedAt: "2026-10-28",
  },
  "chest-dip": {
    url: "https://www.youtube.com/watch?v=wjUmnZH528Y",
    title: "How To Do Dips - Chest & Triceps Exercise",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22dips%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "machine-chest-press": {
    url: "https://www.youtube.com/watch?v=ssZGW6xCVpM",
    title: "Chest Press Machine tutorial",
    creator: "Idris",
    source:
      "https://www.bing.com/videos/search?q=%22Machine%20Chest%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "pec-deck": {
    url: "https://www.youtube.com/watch?v=Tq0MPLKvrsI",
    title: "Perfect Pec Deck Fly Tutorial ✅",
    creator: "Parveen Fitness",
    source: "https://www.bing.com/videos/search?q=%22pec%20deck%22",
    reviewedAt: "2026-10-28",
  },
  "overhead-press": {
    url: "https://www.youtube.com/watch?v=F3QY5vMz_6I",
    title: "How to Perform Overhead Press - Proper Technique & Form",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22overhead%20press%22",
    reviewedAt: "2026-10-28",
  },
  "push-press": {
    url: "https://www.youtube.com/watch?v=kmd06AejKTE",
    title: "Barbell Push Press",
    creator: "Zoë Kremer - Personal Trainer",
    source: "https://www.bing.com/videos/search?q=%22Push%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "upright-row": {
    url: "https://www.youtube.com/watch?v=dKHSygiqgjU",
    title:
      "How to Actually Grow Bigger Shoulders Fast with Upright Rows. #uprightrow #shoulderexercise",
    creator: "Gymbro001 | Workout Form & Muscle Growth",
    source: "https://www.bing.com/videos/search?q=%22Upright%20Row%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-shoulder-press": {
    url: "https://www.youtube.com/watch?v=zD-6ES51PZM",
    title: "How to do dumbbell shoulder presses properly 🥥 thesaiyankiwi",
    creator: "The Saiyan Kiwi",
    source:
      "https://www.bing.com/videos/search?q=%22Dumbbell%20Shoulder%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "arnold-press": {
    url: "https://www.youtube.com/watch?v=dylE6r3oQ14",
    title: "How To Do an Arnold Press",
    creator: "Mark Ottobre",
    source: "https://www.bing.com/videos/search?q=%22Arnold%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "lateral-raise": {
    url: "https://www.youtube.com/watch?v=nrlTEP0jK2U",
    title: "How to do lateral raises properly",
    creator: "Xtine Cardenas",
    source: "https://www.bing.com/videos/search?q=%22Lateral%20Raise%22",
    reviewedAt: "2026-10-28",
  },
  "front-raise": {
    url: "https://www.youtube.com/watch?v=UoO0MbXqJzE",
    title: "Build 3D Shoulders Fast: The Perfect Front Raise Form 💯",
    creator: "KC FITNESS",
    source: "https://www.bing.com/videos/search?q=%22Front%20Raise%22",
    reviewedAt: "2026-10-28",
  },
  "rear-delt-fly": {
    url: "https://www.youtube.com/watch?v=0GSu6Z-Oj7U",
    title: "Bowflex® How-To | Rear Delt Fly for Beginners",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22rear%20delt%20fly%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-shrug": {
    url: "https://www.youtube.com/watch?v=ZMkMcjnThJQ",
    title: "The ONLY Way You Should Be Doing Dumbbell Shrugs for Bigger Traps",
    creator: "KC FITNESS",
    source: "https://www.bing.com/videos/search?q=%22shrugs%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "face-pull": {
    url: "https://www.youtube.com/watch?v=sHSY0Ao8QHs",
    title: "The RIGHT Way To Do Face Pulls (Feat. Andrew Huberman)",
    creator: "ATHLEAN-X™",
    source: "https://www.bing.com/videos/search?q=%22Face%20Pull%22",
    reviewedAt: "2026-10-28",
  },
  "cable-lateral-raise": {
    url: "https://www.youtube.com/watch?v=wCZn-v09cTY",
    title: "How to do Cable Lateral Raise for Bigger Shoulders⁠",
    creator: "Idris",
    source:
      "https://www.bing.com/videos/search?q=%22Cable%20Lateral%20Raise%22",
    reviewedAt: "2026-10-28",
  },
  "cable-rear-delt-fly": {
    url: "https://www.youtube.com/watch?v=L5D_oRuAPcw",
    title:
      "How to PROPERLY Cable Rear Delt Fly (FIX THIS!) #shoulderworkout #fitness #gymmotivation",
    creator: "Colossus Fitness",
    source: "https://www.bing.com/videos/search?q=%22Rear%20Delt%20Fly%22",
    reviewedAt: "2026-10-28",
  },
  "machine-shoulder-press": {
    url: "https://www.youtube.com/watch?v=3R14MnZbcpw",
    title: "How to PROPERLY Shoulder Machine Press (LEARN FAST)",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22shoulder%20press%20machine%22",
    reviewedAt: "2026-10-28",
  },
  "reverse-pec-deck": {
    url: "https://www.youtube.com/watch?v=dC7jhEk-29A",
    title: "How to PROPERLY Reverse Pec Deck Fly (DO THIS)",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22reverse%20pec%20deck%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-curl": {
    url: "https://www.youtube.com/watch?v=5x2anx4fgXo",
    title: "How to PROPERLY Dumbbell Bicep Curl (DO THIS NOW!)",
    creator: "Colossus Fitness",
    source: "https://www.bing.com/videos/search?q=%22biceps%20curls%22",
    reviewedAt: "2026-10-28",
  },
  "hammer-curl": {
    url: "https://www.youtube.com/watch?v=3YYRmJ3RBj0",
    title: "How to Do Hammer Curls (Proper Form Guide)",
    creator: "Patrick Frost",
    source: "https://www.bing.com/videos/search?q=%22Hammer%20Curl%22",
    reviewedAt: "2026-10-28",
  },
  "incline-dumbbell-curl": {
    url: "https://www.youtube.com/watch?v=Hu2VPrfj7TQ",
    title:
      "How to Perform Incline Dumbbell Curls for Maximum Bicep Growth | Perfect Form = Perfect Growth🫡#gym",
    creator: "Fitwithshrikant",
    source:
      "https://www.bing.com/videos/search?q=%22Incline%20Barbell%20Bench%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "concentration-curl": {
    url: "https://www.youtube.com/watch?v=ZcU2hN76UyA",
    title: "Concentration Curls - Biceps Exercise - Bodybuilding.com",
    creator: "Bodybuilding.com",
    source:
      "https://www.bing.com/search?format=rss&q=%22concentration%20curl%22",
    reviewedAt: "2026-10-28",
  },
  "overhead-dumbbell-triceps-extension": {
    url: "https://www.youtube.com/watch?v=yj1uC4At8rw",
    title:
      "Overhead Dumbbell Tricep Extension | Build Stronger, Bigger Triceps #strengthtraining",
    creator: "One Life Personal Training",
    source:
      "https://www.bing.com/videos/search?q=%22Overhead%20Dumbbell%20Triceps%20Extension%22",
    reviewedAt: "2026-10-28",
  },
  "triceps-kickback": {
    url: "https://www.youtube.com/watch?v=ShCYaoHmWmk",
    title: "Dumbbell Kickback",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22dumbbell%20kickbacks%22",
    reviewedAt: "2026-10-28",
  },
  "barbell-curl": {
    url: "https://www.youtube.com/watch?v=O5DqzSn2owM",
    title: "How to Get MASSIVE Biceps: PERFECT Barbell Curl Form! 🏋️‍♂️🔥",
    creator: "KC FITNESS",
    source: "https://www.bing.com/videos/search?q=%22Barbell%20Hip%20Thrust%22",
    reviewedAt: "2026-10-28",
  },
  "close-grip-bench-press": {
    url: "https://www.youtube.com/watch?v=YvQK3iZQ-J8",
    title:
      "Close-Grip Barbell Bench Press: Proper form & Technique (Step-by-Step-guide) | GrabGains",
    creator: "GrabGains",
    source:
      "https://www.bing.com/videos/search?q=%22Barbell%20Bench%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "ez-bar-curl": {
    url: "https://www.youtube.com/watch?v=7lZ78fo-yUA",
    title: "How to Do an EZ Bar Curl (Proper Form) 👀",
    creator: "HW Motivation",
    source: "https://www.bing.com/videos/search?q=%22EZ%20Bar%20Curl%22",
    reviewedAt: "2026-10-28",
  },
  "preacher-curl": {
    url: "https://www.youtube.com/watch?v=OmZedmfnpTE",
    title:
      "How to Actually Grow Bigger Biceps Fast with EZ bar Preacher Curl. #preachercurls #bicepsexercise",
    creator: "Gymbro001 | Workout Form & Muscle Growth",
    source: "https://www.bing.com/videos/search?q=%22EZ%20Bar%20Curl%22",
    reviewedAt: "2026-10-28",
  },
  "skull-crusher": {
    url: "https://www.youtube.com/watch?v=d_KZxkY_0cM",
    title: "How To: Skull Crushers",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22skull%20crushers%22",
    reviewedAt: "2026-10-28",
  },
  "reverse-curl": {
    url: "https://www.youtube.com/watch?v=KakQSkPr1YQ",
    title: "Reverse Curl - Proper Grip for Maximum Bicep Gains! #shorts",
    creator: "Criticalbench",
    source: "https://www.bing.com/videos/search?q=%22Reverse%20Curl%22",
    reviewedAt: "2026-10-28",
  },
  "cable-curl": {
    url: "https://www.youtube.com/watch?v=5JPHcbI6jaw",
    title: "How to set up a Cable Curl for maximum bicep growth",
    creator: "Spartanomics",
    source: "https://www.bing.com/videos/search?q=%22Cable%20Curl%22",
    reviewedAt: "2026-10-28",
  },
  "triceps-pushdown": {
    url: "https://www.youtube.com/watch?v=HIKzvHkibWc",
    title: "Triceps Pushdown - Tricep Exercise - Bodybuilding.com",
    creator: "Bodybuilding.com",
    source: "https://www.bing.com/search?format=rss&q=%22triceps%20pushdown%22",
    reviewedAt: "2026-10-28",
  },
  "rope-triceps-pushdown": {
    url: "https://www.youtube.com/watch?v=9euK-0PL358",
    title: "How To Do Triceps Rope Pushdown Correctly | Build Bigger Arms",
    creator: "Herasna",
    source: "https://www.bing.com/videos/search?q=%22Triceps%20Pushdown%22",
    reviewedAt: "2026-10-28",
  },
  "overhead-cable-triceps-extension": {
    url: "https://www.youtube.com/watch?v=09gpiVqdpPM",
    title: "Overhead Cable Tricep Extension Technique Tutorial",
    creator: "brockashby",
    source:
      "https://www.bing.com/videos/search?q=%22Overhead%20Cable%20Triceps%20Extension%22",
    reviewedAt: "2026-10-28",
  },
  "triceps-dip": {
    url: "https://www.youtube.com/watch?v=wjUmnZH528Y",
    title: "How To Do Dips - Chest & Triceps Exercise",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22dips%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "russian-twists": {
    url: "https://www.youtube.com/watch?v=H4tMFJoyAd8",
    title: "How to Do Russian Twist",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22russian%20twist%22",
    reviewedAt: "2026-10-28",
  },
  crunch: {
    url: "https://www.youtube.com/watch?v=Xyd_fa5zoEU",
    title: "How to Do Crunches",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22crunches%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "bicycle-crunch": {
    url: "https://www.youtube.com/watch?v=1we3bh9uhqY",
    title: "How to do a Bicycle Crunch",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22bicycle%20crunch%22",
    reviewedAt: "2026-10-28",
  },
  "reverse-crunch": {
    url: "https://www.youtube.com/watch?v=gAyTBB4lm3I",
    title: "Reverse Crunch",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22reverse%20crunch%22",
    reviewedAt: "2026-10-28",
  },
  "sit-up": {
    url: "https://www.youtube.com/watch?v=9OlFXn7fwHA",
    title:
      "🔥 Do Sit-Ups the RIGHT Way | Build a Stronger Core with Proper Form",
    creator: "Upgraded Fitness",
    source: "https://www.bing.com/videos/search?q=%22Sit-up%22",
    reviewedAt: "2026-10-28",
  },
  "dead-bug": {
    url: "https://www.youtube.com/watch?v=4XLEnwUr1d8",
    title: "Dead Bug - Abdominal / Core Exercise Guide",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22dead%20bug%22",
    reviewedAt: "2026-10-28",
  },
  "bird-dog": {
    url: "https://www.youtube.com/watch?v=AmMJmSmEyrI",
    title: "How to Do a Bird Dog Correctly for Maximum Core Stability",
    creator: "Julie & Zach @ Mindset Fitness",
    source: "https://www.bing.com/videos/search?q=%22Bird%20Dog%22",
    reviewedAt: "2026-10-28",
  },
  "leg-raise": {
    url: "https://www.youtube.com/watch?v=-OoLk3ICes8",
    title: "How To Do Leg Raises | Correct Form",
    creator: "Calixpert",
    source: "https://www.bing.com/videos/search?q=%22Leg%20Raise%22",
    reviewedAt: "2026-10-28",
  },
  "hanging-knee-raise": {
    url: "https://www.youtube.com/watch?v=l7OroezzX9k",
    title: "Hanging Knee Raise Tutorial - Proper Form and Technique",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22hanging%20knee%20raise%22",
    reviewedAt: "2026-10-28",
  },
  "hanging-leg-raise": {
    url: "https://www.youtube.com/watch?v=mc0IojJmpzQ",
    title: "How to do Hanging Leg Raises the Easy, Medium, and Hard Way",
    creator: "TylerPath",
    source: "https://www.bing.com/videos/search?q=%22Leg%20Raise%22",
    reviewedAt: "2026-10-28",
  },
  "mountain-climber": {
    url: "https://www.youtube.com/watch?v=cnyTQDSE884",
    title: "How to Do Mountain Climbers | The Right Way | Well+Good",
    creator: "Well+Good",
    source:
      "https://www.bing.com/search?format=rss&q=%22mountain%20climbers%22",
    reviewedAt: "2026-10-28",
  },
  "heel-tap": {
    url: "https://www.youtube.com/watch?v=w2Um9ULrcBI",
    title: "Heel taps",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22heel%20taps%22",
    reviewedAt: "2026-10-28",
  },
  plank: {
    url: "https://www.youtube.com/watch?v=puJ0h7U34gI",
    title: "How To Do A PERFECT PLANK.",
    creator: "ArielYu_Fit",
    source: "https://www.bing.com/videos/search?q=%22Plank%22",
    reviewedAt: "2026-10-28",
  },
  "side-plank": {
    url: "https://www.youtube.com/watch?v=oaJ15vYERoU",
    title: "How to Do a Side Plank Correctly (For Beginners)",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22side%20plank%22",
    reviewedAt: "2026-10-28",
  },
  "hollow-body-hold": {
    url: "https://www.youtube.com/watch?v=TNHSgs_orU0",
    title: "How to do a Hollow Hold | The Right Way | Well+Good",
    creator: "Well+Good",
    source:
      "https://www.bing.com/search?format=rss&q=%22hollow%20body%20hold%22",
    reviewedAt: "2026-10-28",
  },
  "superman-hold": {
    url: "https://www.youtube.com/watch?v=LZoWdePF1NQ",
    title:
      "How To Do A SUPERMAN HOLD | Exercise Demonstration Video and Guide ...",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22superman%20hold%22",
    reviewedAt: "2026-10-28",
  },
  "pallof-press": {
    url: "https://www.youtube.com/watch?v=_2xWmYNnFS8",
    title: "How to Do the Pallof Press (Perfect Form for a Stronger Core)",
    creator: "Colossus Fitness",
    source: "https://www.bing.com/videos/search?q=%22Pallof%20Press%22",
    reviewedAt: "2026-10-28",
  },
  "cable-crunch": {
    url: "https://www.youtube.com/watch?v=b-PXospg4LA",
    title:
      "Cable Kneeling Crunch: Build Stronger Abs With Correct Form 💪🔥 #shorts",
    creator: "Daily Exercise",
    source: "https://www.bing.com/videos/search?q=%22Cable%20Crunch%22",
    reviewedAt: "2026-10-28",
  },
  "cable-woodchop": {
    url: "https://www.youtube.com/watch?v=Gwcf4TOj1hc",
    title: "Cable Woodchop | Proper Form Tutorial for Core Rotation",
    creator: "FIT.nl",
    source: "https://www.bing.com/videos/search?q=%22Cable%20Woodchop%22",
    reviewedAt: "2026-10-28",
  },
  "ab-wheel-rollout": {
    url: "https://www.youtube.com/watch?v=PK4n7qJpOhM",
    title: "Ab Wheel Rollouts (Beginner to Advanced Progressions)",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22ab%20wheel%22",
    reviewedAt: "2026-10-28",
  },
  "medicine-ball-russian-twist": {
    url: "https://www.youtube.com/watch?v=weWdcpkij5E",
    title: "Medicine Ball Russian Twist | Core Rotation Exercise",
    creator: "Whole Health Solutions &",
    source: "https://www.bing.com/videos/search?q=%22russian%20twist%22",
    reviewedAt: "2026-10-28",
  },
  "kettlebell-swing": {
    url: "https://www.youtube.com/watch?v=ZLhcDXnG7sI",
    title:
      "The secret to a perfect kettlebell swing #fitness #kettlebell #technique",
    creator: "Tony Skys",
    source: "https://www.bing.com/videos/search?q=%22Kettlebell%20Swing%22",
    reviewedAt: "2026-10-28",
  },
  "kettlebell-clean": {
    url: "https://www.youtube.com/watch?v=tvZ50scjwAo",
    title: "How to do a kettlebell clean",
    creator: "Pat Damiano",
    source: "https://www.bing.com/videos/search?q=%22Kettlebell%20Clean%22",
    reviewedAt: "2026-10-28",
  },
  "kettlebell-snatch": {
    url: "https://www.youtube.com/watch?v=x0iUyMjbEo8",
    title: "Clean to Press to Snatch Simple Progression",
    creator: "Mark Wildman",
    source: "https://www.bing.com/videos/search?q=%22Kettlebell%20Clean%22",
    reviewedAt: "2026-10-28",
    note: "This progression tutorial includes clean and press preparation before the snatch.",
  },
  "turkish-get-up": {
    url: "https://www.youtube.com/watch?v=sgd8n917Zv0",
    title: "How to do a Turkish get-up",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22turkish%20get-up%22",
    reviewedAt: "2026-10-28",
  },
  "power-clean": {
    url: "https://www.youtube.com/watch?v=KwYJTpQ_x5A",
    title: "The Power Clean",
    creator: "CrossFit",
    source: "https://www.bing.com/search?format=rss&q=%22power%20clean%22",
    reviewedAt: "2026-10-28",
  },
  "hang-clean": {
    url: "https://www.youtube.com/watch?v=TjTEOme9fvw",
    title: "The Hang Clean",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22hang%20clean%22",
    reviewedAt: "2026-10-28",
  },
  "clean-and-jerk": {
    url: "https://www.youtube.com/watch?v=IcCGLoNqN2U",
    title: "Beginners Guide to Clean & Jerk with Meg Squats | JTSstrength.com",
    creator: "Juggernaut Training Systems",
    source: "https://www.bing.com/videos/search?q=%22Clean%20and%20Jerk%22",
    reviewedAt: "2026-10-28",
  },
  snatch: {
    url: "https://www.youtube.com/watch?v=ygoz0ANCcto",
    title:
      "How to Snatch: Beginners Guide of Olympic Weightlifting / Torokhtiy & Rebeka",
    creator: "TOROKHTIY",
    source: "https://www.bing.com/videos/search?q=%22snatch%20technique%22",
    reviewedAt: "2026-10-28",
  },
  "barbell-thruster": {
    url: "https://www.youtube.com/watch?v=L219ltL15zk",
    title: "The Thruster",
    creator: "CrossFit",
    source: "https://www.bing.com/search?format=rss&q=%22thrusters%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-thruster": {
    url: "https://www.youtube.com/watch?v=VhtWz45DAGw",
    title: "Dumbbell Thruster: Full-Body Strength & Power | Pherform HK",
    creator: "Pherform Studio",
    source: "https://www.bing.com/videos/search?q=%22dumbbell%20thrusters%22",
    reviewedAt: "2026-10-28",
  },
  "renegade-row": {
    url: "https://www.youtube.com/watch?v=Q28cLuweLv4",
    title: "How To Do A Renegade Row",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22renegade%20row%22",
    reviewedAt: "2026-10-28",
  },
  "dumbbell-snatch": {
    url: "https://www.youtube.com/watch?v=A7Tf-dNMook",
    title: "Learn Proper Dumbbell Snatch Technique",
    creator: "Monroe Miller",
    source: "https://www.bing.com/videos/search?q=%22snatch%20technique%22",
    reviewedAt: "2026-10-28",
  },
  "farmer's-carry": {
    url: "https://www.youtube.com/watch?v=8RXTKE06mKc",
    title: "Farmer's Carry Tutorial",
    creator: "Nicole Zapoli",
    source: "https://www.bing.com/videos/search?q=%22Farmer%27s%20Carry%22",
    reviewedAt: "2026-10-28",
  },
  "suitcase-carry": {
    url: "https://www.youtube.com/watch?v=CtrXZ8rGR8E",
    title: "Suitcase Carry - Exercise Demonstration",
    creator: "VTS Performance",
    source: "https://www.bing.com/videos/search?q=%22Suitcase%20Carry%22",
    reviewedAt: "2026-10-28",
  },
  burpee: {
    url: "https://www.youtube.com/watch?v=qLBImHhCXSw",
    title: "How To Do A Burpee | The Right Way | Well+Good",
    creator: "Well+Good · Charlee Atkins",
    source: "https://www.bing.com/search?format=rss&q=%22burpee%22",
    reviewedAt: "2026-10-28",
  },
  "medicine-ball-slam": {
    url: "https://www.youtube.com/watch?v=YFORkljMrEQ",
    title: "How to do Medicine Ball Slams for Core Strength and Conditioning",
    creator: "Seriously Strong Training",
    source: "https://www.bing.com/videos/search?q=%22Medicine%20Ball%20Slam%22",
    reviewedAt: "2026-10-28",
  },
  "wall-ball": {
    url: "https://www.youtube.com/watch?v=ZrMjD4m3HxI",
    title: "PROPER WALL BALL FORM",
    creator: "Rise Fitness",
    source: "https://www.bing.com/videos/search?q=%22Wall%20Ball%22",
    reviewedAt: "2026-10-28",
  },
  running: {
    url: "https://www.youtube.com/watch?v=aD3KTUZJJ3U",
    title:
      "The Running Pose Every Fast Runner Uses #running #runningform #injuryprevention",
    creator: "RunRX",
    source: "https://www.bing.com/videos/search?q=%22running%20form%22",
    reviewedAt: "2026-10-28",
  },
  walking: {
    url: "https://www.youtube.com/watch?v=cvEJ5WFk2KE",
    title: "30 Minute Boosted Fitness Walk | Walk at Home",
    creator: "Walk at Home",
    source: "https://www.bing.com/search?format=rss&q=%22walking%20lunge%22",
    reviewedAt: "2026-10-28",
    note: "Follow-along walking session; choose a pace and duration that match your plan.",
  },
  "high-knees": {
    url: "https://www.youtube.com/watch?v=IrqItHfTXos",
    title: "How to Do High Knees Correctly (Burn Fat FAST!) | Cardio ...",
    creator: "",
    source:
      "https://www.bing.com/search?format=rss&q=%22high%20knees%20exercise%22",
    reviewedAt: "2026-10-28",
  },
  "jumping-jacks": {
    url: "https://www.youtube.com/watch?v=uLVt6u15L98",
    title: "How to do a Jumping Jack | Proper Form & Technique | NASM",
    creator: "",
    source: "https://www.bing.com/search?format=rss&q=%22jumping%20jacks%22",
    reviewedAt: "2026-10-28",
  },
  "treadmill-run": {
    url: "https://www.youtube.com/watch?v=G7QjU44eBvA",
    title: "How To Run On A Treadmill Properly And Improve Your Running Form",
    creator: "TreadmillReviewGuru",
    source: "https://www.bing.com/videos/search?q=%22treadmill%20tips%22",
    reviewedAt: "2026-10-28",
  },
  "stationary-bike": {
    url: "https://www.youtube.com/watch?v=6HIrPFU0ty0",
    title: "30-min. UNSTOPPABLE Indoor Cycling Workout",
    creator: "Kaleigh Cohen Cycling",
    source: "https://www.bing.com/videos/search?q=%22indoor%20cycling%22",
    reviewedAt: "2026-10-28",
    note: "Follow-along indoor cycling session; adjust the duration and resistance to match your plan.",
  },
  "rowing-machine": {
    url: "https://www.youtube.com/watch?v=8NQmi-yYqN4",
    title: "How to Use a Rowing Machine for Beginners (cardio)",
    creator: "All Strong Fitness",
    source: "https://www.bing.com/videos/search?q=%22Rowing%20Machine%22",
    reviewedAt: "2026-10-28",
  },
  elliptical: {
    url: "https://www.youtube.com/watch?v=dBMotc3AiVc",
    title:
      "ELLIPTICAL TUTORIAL 🏃🏻‍♂️ // Low-impact cardio that uses your full body at Planet Fitness!",
    creator: "KevTheTrainer",
    source: "https://www.bing.com/videos/search?q=%22Elliptical%22",
    reviewedAt: "2026-10-28",
  },
  "stair-climber": {
    url: "https://www.youtube.com/watch?v=LrqpqyngO7I",
    title:
      "How to use the Stair Master | Planet Fitness #stairmaster cardio #gymtips",
    creator: "Emily Elle",
    source: "https://www.bing.com/videos/search?q=%22stairmaster%22",
    reviewedAt: "2026-10-28",
  },
  "ski-erg": {
    url: "https://www.youtube.com/watch?v=2hyGyZsPoC4",
    title: "The Ski Erg Explained - technique, benefits and program design",
    creator: "OPEX Fitness",
    source: "https://www.bing.com/videos/search?q=%22Ski%20Erg%22",
    reviewedAt: "2026-10-28",
  },
  "jump-rope": {
    url: "https://www.youtube.com/watch?v=cQ3TqgQpGzg",
    title: "Learn Essential Skipping Rope Moves Fast",
    creator: "Gewafo Setewa",
    source: "https://www.bing.com/videos/search?q=%22skipping%20rope%22",
    reviewedAt: "2026-10-28",
  },
  "battle-ropes": {
    url: "https://www.youtube.com/watch?v=Cr_yS1-pVBU",
    title:
      "BATTLE ROPES TUTORIAL 🔥 // Build muscular and cardio endurance with these ropes at Planet Fitness!",
    creator: "KevTheTrainer",
    source: "https://www.bing.com/videos/search?q=%22Battle%20Ropes%22",
    reviewedAt: "2026-10-28",
  },
  "cable-kickback": {
    url: "https://www.youtube.com/watch?v=8617HjJwLHA",
    title:
      "The Cable Kickback Setup Nobody Gets Right #glutes #fitness #shorts",
    creator: "Stefi Cohen",
    source: "https://www.bing.com/videos/search?q=%22cable%20kickbacks%22",
    reviewedAt: "2026-10-28",
  },
  "split-squat": {
    url: "https://www.youtube.com/watch?v=PCuLTrZwT4U",
    title: "How to set up split squats",
    creator: "Caitie June",
    source: "https://www.bing.com/videos/search?q=%22Split%20Squat%22",
    reviewedAt: "2026-10-28",
  },
};
export function libraryExerciseVideo(name) {
  const exercise = exerciseByName(name);
  return exercise ? exerciseVideos[exercise.id] : undefined;
}
