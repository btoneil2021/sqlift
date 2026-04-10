# **SQLift**

#### (CS5200: Database Management Systems Project)

### Project Description:

We are O' NeilBShettySQureshiS (Sudaiv Shetty, Shaad Qureshi, and Ben O’Neil). Our project is a comprehensive workout tracking site called SQLift. This site will feature an interactive browser-displayed frontend along with our SQL database backend. On the side of the user, they will be allowed to create an account, enter biometric information, track and record the minutiae of their workouts. They can view the status of these workouts in their own data visualization page, or compare with friends and the world via a leaderboards page. 

### Application Description:

SQLift is a workout tracking web application designed to aid in planning, executing and analyzing fitness training. Through SQLift, users can build custom workouts by selecting from a library of exercises. Each exercise is tied to specific muscle groups and equipment. During a live session, users can log every exercise set with weights, reps, and rest time in real time. Beyond planning workouts, SQLift also tracks progress over time by using graph visualization. The app also has a leadership board that acts as a social layer allowing users to compete with friends, with visibility into each other’s activity.

### User Flow:

A new or existing user will be prompted immediately with an Authentication page to either log in or sign up.Once the authentication is done, the user will then be able to gain access to the home page. The home page serves as the central hub for viewing the workout calendar and managing the workouts. Users can create a new workout by naming, and populating it with exercises sourced from the searchable exercise library. When ready, the users can then open a saved workout, preview it, and start a live session. During the session, they can log records and sets exercises by exercise until they hit "End Workout". Post-session, they can track their progress through graphs or check the leaderboard to check their Personal PRs and see how they fare against friends.

### Why this domain?:

It is a deeply data-rich domain that uses structured relational modeling. Every workout session generates layered and nested data. Sessions contain records, records contain sets, sets contain reps and weight. This makes it a natural fit for a relational database like MySQL. The domain also demands a historical comparison, tracking analysis and social features such as the leaderboard. All of these play to SQL’s strengths in querying structured data. SQLift was chosen because it gives the database a meaningful real-world complexity to model and explore.

### Database Description:

We have a database for a comprehensive workout tracking site called SQLift. Each unique account on the site is a user. A user has a unique, automatically defined user\_id, a unique username, a first and last name, a height, a sex, a unique email address, a unique phone number, profile photo url, and a password. A user can be friends with zero to many other users. When two users are friends, the relationship tracks a friendship level that determines the visibility each user has into the other user’s activity. A user can have zero to many workouts. A particular workout can only be owned and used by a single user. A workout is defined as a specific series of exercises that someone has defined to do on a particular day. It has a workout name, which when combined with a user’s ID makes the workout unique. It has a preferred day, a primary muscle group (determined by the exercises contained in the workout). A workout can have one to many workout tag. A workout tag can “tag” zero to many user workouts. A workout tag has a tag name (such as “Push,” “Pull,” or “Legs”) that is a unique identifier for the tag, as well as a color represented in the form of a hex code.

	A workout is a template for a user to create individual workout sessions. A workout can template zero to many workout sessions. A workout session can be templated by one and only one workout. A workout session has a start date and time, an end date and time, notes on how the workout went, the current status of the workout (options are “Not Started”, “In Progress”, and “Completed”). The start date and time as well as the unique identifiers for a user workout makes a workout session unique. It also has attributes that are only determined after the workout session has ended, such as a personal difficulty rating of that particular session, a personal enjoyment rating, and an energy level rating after completion of the session. 

A workout session has one to many record logs. A record log is contained in one and only one workout session. If a workout session is an overview of an entire session, a record log is an overview of what is done with a specific exercise. A record log contains a number representing where it is located in the workout session (first record is a 1, next is a 2, and so on), which along with the identifier for the workout session makes the record log unique. It also contains the timestamp of the start of the record, duration that the current record ran for and the number of sets in the record, calculated from the number of set logs associated with the record. A set log is associated with one and only one record log. A record log can have one to many set logs. A set log is the specific information of what is done in a single set of a record. A set log has a set number that, combined with the identifying attributes of its associated record log, makes it unique. It has a type describing the kind of set being performed ("Warm-up," "Working," or "Drop"), the weight used during the set, the number of reps completed, an RPE (rate of perceived exertion) rating indicating how difficult the set felt to the user, and the rest time taken after the set. 

A muscle group represents a specific area of the body that can be targeted by exercises. A muscle group has a unique and automatically defined muscle group ID, a unique name, and a textual description. A piece of equipment represents a specific tool or machine that can be used to perform exercises. A piece of equipment has a unique and automatically defined equipment ID, a unique name and a textual description.

An exercise represents a specific movement that can be performed during a workout. An exercise has a unique and automatically defined ID, a unique name, a textual description, whether or not the exercise is unilateral (performed one side at a time), and instructions on how to properly perform the exercise. An exercise can appear in zero to many workouts, and a workout can contain zero to many exercises (as there are no exercises there when first creating the workout). When an exercise is included in a workout, the relationship tracks the expected order of the exercise in the workout, the target number of sets, the target number of reps, the target weight, and the expected rest time between sets. An exercise can work zero to many muscle groups, and a muscle group can be worked by zero to many exercises. When an exercise works a muscle group, the relationship tracks the role that the muscle group plays in the exercise (one of “Primary,” “Secondary,” or “Stabilizer”). An exercise can use zero to many pieces of equipment, and a piece of equipment can be used by zero to many exercises. An exercise can also have one to many record logs associated with it, while a record log is associated with one and only one exercise. 

	A measurement log tracks a user’s body measurements at a specific point in time. A measurement log has a date and timestamp, which along with the user’s ID uniquely defines a measurement log. It also records measurements for height, weight, visual body fat percentage, and circumferences of the neck, shoulders, chest, biceps, forearms, waist, hips, thighs, and calves. A user can have zero to many measurement logs, and a measurement log belongs to one and only one user.

	A media item represents visual content stored in the system for the purposes of showcasing an exercise. A media item has a unique link for the media and a type indicating the file type of the media source. A media file can be associated with zero to one exercise, and an exercise can contain one to many media files. An exercise has at least one media item demonstrating the movement, and a media item may belong to zero to one exercise.

	A user goal represents a personal fitness objective that a user has set for themselves. A user goal has a unique, automatically defined goal ID, a description of the goal, a target date for completion, and a completion status. A user can have one to many user goals, and a user goal belongs to one and only one user. 

An achievement represents a milestone or accomplishment that users can earn on the platform. An achievement has a unique, automatically defined achievement ID, a name, a description and a url for an icon associated with it. A user can earn zero to many achievements, and an achievement can be earned by zero to many users. When a user earns an achievement, the relationship tracks the date the achievement was earned.

### Technology Stack:

* Database: PostgreSQL / MySQL  
* Frontend: React-based web Application  
* Backend: Flask-based backend  
* Hosting: Vercel

### Development Tools:

* Hardware  
  * Windows 11 Laptops  
      
* Software  
  * Visual Studio Code

* Languages  
  * React  
  * Python (Flask)  
  * SQL

* Libraries & Services  
  * Vercel

### Machine Limitations:
* Requires an internet browser and a persistent internet connection.