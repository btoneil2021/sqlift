# SQLift Achievement Ideas

Based on the [Design Document](file:///e:/College/5200%20Database%20Management/Project/cs-5200-project/docs/design_doc.md) and [Database Schema](file:///e:/College/5200%20Database%20Management/Project/cs-5200-project/docs/database_schema.sql), here is a categorized list of potential achievements to gamify the SQLift experience.

## 🚀 Onboarding & First Steps
| Achievement Name | Description | Trigger |
| :--- | :--- | :--- |
| **First Contact** | Welcome to SQLift! Create your first account. | Account creation. |
| **Blueprint Creator** | Set up your very first workout template. | First entry in `sqlift.workout`. |
| **Baptism by Iron** | Complete your first workout session. | First `workout_session` with status 'Completed'. |
| **Goal Setter** | Define what you want to achieve. | Create your first `user_goal`. |

## 🔥 Consistency & Streaks
| Achievement Name | Description | Trigger |
| :--- | :--- | :--- |
| **Habit Former** | Complete 3 workouts in a single week. | 3 `workout_session` entries in a 7-day window. |
| **Unstoppable** | Maintain a 7-day workout streak. | Daily `workout_session` for 7 consecutive days. |
| **Early Bird** | Getting after it while the world sleeps. | Complete a workout before 7:00 AM. |
| **Night Owl** | The gym is your sanctuary at night. | Complete a workout after 10:00 PM. |
| **Venerated Veteran** | Log 100 total workout sessions. | Count of `workout_session` >= 100. |

## 💪 Performance & Strength
| Achievement Name | Description | Trigger |
| :--- | :--- | :--- |
| **PR Crusher** | Break a personal record on any exercise. | New `weight` > previous `max(weight)` for an `exercise_id`. |
| **Volume King** | Move over 10,000 lbs/kg in a single session. | `sum(weight * reps)` in one session >= 10,000. |
| **Century Club** | Log a set with 100+ reps (Volume focus). | `reps` >= 100 in a single `set_log`. |
| **Heavy Hitter** | Log a set with over 315 lbs (3 plates). | `weight` >= 315 (or metric equivalent) in `set_log`. |
| **No Pain No Gain** | Log a session with an average RPE of 9 or higher. | `avg(rpe)` >= 9 for a completed session. |

## 👥 Social & Competitive
| Achievement Name | Description | Trigger |
| :--- | :--- | :--- |
| **Socialite** | Add your first friend. | First entry in `user_friendship`. |
| **Squad Goals** | Have a friendship level of 'High' with 5 users. | 5 friends with max `friendship_level`. |
| **Top 10%** | Break into the top 10% of any leaderboard. | Rank in `sqlift.leaderboard` top 10%. |
| **King of the Hill** | Reach #1 on a local or global leaderboard. | Rank #1 in any leaderboard category. |

## 📊 Knowledge & Tracking
| Achievement Name | Description | Trigger |
| :--- | :--- | :--- |
| **Bio Tracker** | Log your body measurements for 4 weeks straight. | Weekly `measurement_log` for a month. |
| **Transformation Start** | Update your weight and see progress. | Second `weight` entry in `measurement_log`. |
| **Muscle Scholar** | Work out 5 different muscle groups in one week. | Exercises targeting 5 unique `muscle_id`s in a week. |
| **Tool Master** | Use 10 different types of equipment. | Log exercises using 10 unique `equipment_id`s. |

## 🏆 Special / Milestone
| Achievement Name | Description | Trigger |
| :--- | :--- | :--- |
| **Iron Anniversary** | Been using SQLift for 1 year. | `current_date - user.date_created` >= 365 days. |
| **The Architect** | Create 10 custom workout templates. | 10 entries in `sqlift.workout`. |
| **Completionist** | Reach a 100% completion rate for all sets in a workout. | All `target_sets` met in a `workout_session`. |
