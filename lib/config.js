/* Swole Hub app config (ported from Code.gs). PINs live in the database, not here. */

export const TZ = 'America/New_York';

/* Profiles shown on the picker, in order */
export const USERS = ['Arik', 'Leon 肛卜咛', 'Desitrain', 'Patty Cakes', '小肥羊'];

/* Per-profile welcome message shown on login (blank = no popup) */
export const WELCOME = {
  'Desitrain': 'ٱلسَّلَامُ عَلَيْكُمْ gujju gang',
  'Patty Cakes': 'Bine ai revenit Patty Cakes',
  'Leon 肛卜咛': '你回来了宝贝儿儿儿 .... uwu',
  '小肥羊': '欢迎 chinese fyne shyt'
};

/* Fine Arts is private to these profiles only */
export const ARTS_USERS = ['Arik'];

/* One-time relabels applied during import */
export const RENAMES = { 'User 2': 'Leon 肛卜咛' };

/* weekly-target "Other Exercises" */
export const EXTRA_TARGETS = { 'Bar Hang': 7, 'Swimming': 3, 'Cycling': 3 };
export const FINE_ARTS = ['Piano', 'Saxophone', 'Chinese (Rednote)', 'Japanese (news/video)', 'Korean (news/shows)'];
export const KEY_LIFTS = ['Barbell Bench', 'Back Squat', 'Front Squat', 'OHP', 'Lat Pulldown', 'Barbell Curls'];
/* Lifts that log as a pyramid (per-set weight/reps). PR = heaviest set reached. */
export const PYRAMID_EXERCISES = ['Barbell Bench'];
export const START_DATE = '2025-03-04';
export const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
export const MON_FIRST = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* Default program seeded for any profile that has none yet.
   [Day, Order, Exercise, Sets, Reps, TargetWeight, LoadType, Category, Preset] */
export const PROGRAM = [
  ['Monday',1,'Barbell Bench',5,7,195,'total','Chest/Arms - Push','5×6-8 | 45+25+5 = 195'],
  ['Monday',2,'Dumbbell Incline Bench',3,4,145,'total','Chest/Arms - Push','4 | 45+5 (145lb)'],
  ['Monday',3,'Cable Flies',3,16,40,'total','Chest/Arms - Push','16 | 40lb ^#'],
  ['Monday',4,'Lateral Raises (slow)',3,21,20,'total','Chest/Arms - Push','21 | 20lb'],
  ['Monday',5,'Face Pull',3,20,60,'total','Chest/Arms - Pull','20 | 60lb ^#'],
  ['Monday',6,'Push/Pull Downs',3,14,60,'total','Chest/Arms - Push','14 | 60lb'],
  ['Monday',7,'Opposite (new)',3,8,50,'total','Chest/Arms - Push','^ 8 | 50lb  (new workout)'],
  ['Monday',8,'Reverse Delt Flex',3,18,17.5,'total','Chest/Arms - Pull','18 | 17.5lb'],
  ['Monday',9,'Skull Crushers',3,12,30,'total','Chest/Arms - Push','12 | 30?'],
  ['Tuesday',1,'Rowing Machine',0,0,0,'','Cardio','30 min'],
  ['Tuesday',2,'Stairmaster',0,0,0,'','Cardio','20 min | level 10'],
  ['Tuesday',3,'Inside Run',0,0,0,'','Cardio','25 min | 12:40 pace'],
  ['Tuesday',4,'Outside Run',0,0,0,'','Cardio','30 min'],
  ['Wednesday',1,'Back Squat',4,14,70,'total','Legs - Push','4•14 | 70lb'],
  ['Wednesday',2,'Leg Press',3,15,100,'total','Legs - Push','15 | 100lb'],
  ['Wednesday',3,'Thinker Curl',3,20,25,'total','Chest/Arms - Pull','20 | 25 ^#'],
  ['Wednesday',4,'Leg Curls',3,20,90,'total','Legs - Pull','20 | 90 ^#'],
  ['Wednesday',5,'Leg Raises',3,15,90,'total','Legs - Push','15 | 90'],
  ['Wednesday',6,'Leg Raise / Glute Press',3,20,120,'total','Legs - Pull','20 | 120 ^#'],
  ['Wednesday',7,'Dumbbell Overhead Extension (Neal Dumbbell Thing)',3,18,35,'total','Chest/Arms - Push','18 | 35'],
  ['Wednesday',8,'Barbell Curls',3,10,22.5,'e/s','Chest/Arms - Pull','3×10 | 20→22.5 (e/s) / 45'],
  ['Wednesday',9,'Lateral Raises',3,18,20,'total','Chest/Arms - Push','18 | 20'],
  ['Thursday',1,'Rowing Machine',0,0,0,'','Cardio','30 min'],
  ['Thursday',2,'Stairmaster',0,0,0,'','Cardio','20 min | level 10'],
  ['Thursday',3,'Inside Run',0,0,0,'','Cardio','25 min | 12:40 pace'],
  ['Thursday',4,'Outside Run',0,0,0,'','Cardio','30 min'],
  ['Friday',1,'OHP',3,10,20,'total','Chest/Arms - Push','10/11 | 20lb'],
  ['Friday',2,'T-bar / ISO-Lateral Row',3,19,90,'total','Chest/Arms - Pull','19 | 90lb'],
  ['Friday',3,'Lean Back Thing',3,12,0,'total','Chest/Arms - Pull','the lean back thing  ?'],
  ['Friday',4,'Lateral Raises',3,21,20,'total','Chest/Arms - Push','21 | 20lb'],
  ['Friday',5,'Lat Pulldown',3,20,120,'total','Chest/Arms - Pull','20 | 120lb  (or 75 e/s)'],
  ['Friday',6,'Cable Push Down',3,15,55,'total','Chest/Arms - Push','15 | 55lb'],
  ['Friday',7,'Seated Row',3,12,99,'total','Chest/Arms - Pull','12 | 99lb'],
  ['Saturday',1,'Front Squat',4,15,70,'e/s','Legs - Push','4•15 | 70 (e/s)'],
  ['Saturday',2,'RDL',3,12,60,'total','Legs - Pull','[?] | 5565'],
  ['Saturday',3,'Leg Press',3,15,200,'total','Legs - Push','15 | 200'],
  ['Saturday',4,'Curl Bar',3,8,60,'total','Chest/Arms - Pull','8 | 60'],
  ['Saturday',5,'Leg Raise / Glute Press',3,15,120,'total','Legs - Pull','15 | 120'],
  ['Saturday',6,'Dumbbell Overhead Extension (Neal Dumbbell Thing)',3,18,35,'total','Chest/Arms - Push','18 | 35'],
  ['Saturday',7,'Reverse Floor Cable',3,10,22.5,'total','Chest/Arms - Pull','10 | 22.5'],
  ['Saturday',8,'Kettlebell Swings',3,25,40,'total','Legs - Pull','25 | 40lb'],
  ['Saturday',9,'Ab Workout',3,20,100,'total','Core','3×20 | 100lb'],
  ['Saturday',10,'Preacher Curl',3,10,45,'total','Chest/Arms - Pull','3×10 | 45'],
  ['Sunday',1,'Rowing Machine',0,0,0,'','Cardio','30 min'],
  ['Sunday',2,'Stairmaster',0,0,0,'','Cardio','20 min | level 10'],
  ['Sunday',3,'Inside Run',0,0,0,'','Cardio','25 min | 12:40 pace'],
  ['Sunday',4,'Outside Run',0,0,0,'','Cardio','30 min']
];
