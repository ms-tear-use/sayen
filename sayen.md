# Sayen — Complete App Build Prompt

Build and continue the existing **Sayen** web app. Do not recreate the project from scratch and do not replace the existing Supabase setup.

## 1. Product

**App name:** Sayen
**Tagline:** “a little space to share.”

Sayen is a **private shared space for exactly two people**.

It should feel like a small, personal digital space where two people can share moments, thoughts, memories, important dates, goals, and small activities together.

This is **not** a social network, dating app, group app, or SaaS dashboard.

The experience should feel:

* warm
* cozy
* personal
* calm
* private
* minimal
* modern
* slightly playful
* intimate without being overly romantic
* simple and easy to use

Avoid:

* corporate dashboard styling
* generic SaaS layouts
* social-media-like feeds
* excessive gradients
* excessive glassmorphism
* excessive animations
* clutter
* huge empty spaces
* overly decorative UI

---

# 2. Important Product Scope

Sayen currently supports **exactly two people** and **one shared Space**.

There is:

* no public registration page
* no group creation
* no group functionality
* no public community
* no connection-type selection UI
* no "create a space" UI
* no "join a space" UI
* no invite UI yet

The database intentionally keeps `connection_type` and `invite_code` because they may be used for future functionality, but **do not build those features now**.

The two users will be manually created in Supabase Auth.

The two users are already connected to one shared Space in the existing database.

Do not add unnecessary onboarding or account-creation flows.

---

# 3. Existing Technology

Use the existing stack:

* React
* Vite
* JavaScript
* Supabase
* PostgreSQL
* Supabase Auth
* CSS

Do not introduce a completely different framework.

Use the existing:

```text
src/supabaseClient.js
```

which already contains the Supabase client.

Environment variables already exist:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
```

Do not hardcode credentials.

---

# 4. Existing Supabase Database

The project already has these tables:

```text
profiles
spaces
space_members
daily_checkins
memories
open_when_letters
important_dates
shared_goals
games
game_answers
```

The database also already has RLS policies.

Do not recreate these tables from React.

Use the existing Supabase database.

The current architecture is:

```text
Auth User
   ↓
profiles
   ↓
space_members
   ↓
spaces
   ↓
shared feature data
```

The user's Space must always be determined through `space_members`.

Do not hardcode the Space ID into the frontend.

Do not hardcode either user's ID into application logic.

---

# 5. Authentication

There is no public signup.

Create a login experience only.

Login screen:

```text
sayen

a little space to share.

Email
[________________]

Password
[________________]

[ log in ]
```

Use:

```js
supabase.auth.signInWithPassword()
```

Handle:

* invalid credentials
* loading state
* Supabase errors
* network errors

After successful login:

```text
Login
 ↓
Supabase Auth session
 ↓
Current user
 ↓
Load profile
 ↓
Find user's Space through space_members
 ↓
Load Space
 ↓
Load both members
 ↓
Home
```

Use `supabase.auth.getSession()` on app startup.

Listen for authentication changes with:

```js
supabase.auth.onAuthStateChange()
```

Provide logout functionality.

---

# 6. Routing

Use protected routes.

Routes:

```text
/
 /login
 /home
 /space
 /check-in
 /memories
 /open-when
 /play
 /settings
```

Behavior:

```text
Not authenticated
→ /login

Authenticated
→ /home
```

Protected pages should not be accessible to unauthenticated users.

Do not expose private data before authentication is confirmed.

---

# 7. Profiles

Existing profile fields:

```text
user_id
display_name
avatar_url
timezone
theme_mode
accent_color
created_at
updated_at
```

Each user has their own:

* display name
* avatar
* timezone
* personal theme
* personal accent color

The app should load the current user's profile.

It should also load the other member's basic profile so the Home page can display both people.

Do not expose unrelated users because Sayen is private to the shared Space.

---

# 8. Timezones

Timezone belongs to the **individual user**, not the Space.

Use:

```js
Intl.DateTimeFormat().resolvedOptions().timeZone
```

to detect the user's timezone when appropriate.

Examples:

```text
Asia/Manila
Asia/Dubai
America/Los_Angeles
```

The current two profiles use:

```text
User 1 → Asia/Manila
User 2 → Asia/Dubai
```

Display each person's local time on the Home page.

For example:

```text
Roxanne
🇵🇭 10:30 AM

User 2
🇦🇪 6:30 PM
```

Do not hardcode these displayed times.

Calculate them dynamically using each profile's timezone.

Use PostgreSQL `timestamptz` for actual timestamps.

For calendar-only events such as birthdays and anniversaries, use the existing `date` fields and do not convert them into timestamps.

---

# 9. Theme System

Sayen has TWO levels of theming.

## Personal Theme

Each user has:

```text
theme_mode
accent_color
```

Theme modes:

```text
Light
Dark
System
```

Accent presets:

```text
Pink
Purple
Blue
Green
Orange
```

A custom color can be supported if practical.

## Shared Space Theme

The Space has:

```text
space_theme_mode
space_accent_color
```

The Space theme applies while the user is inside the shared Space.

Priority:

```text
Inside Sayen Space
→ Space theme overrides personal theme

Outside shared Space
→ Personal theme applies
```

Both users see the same Space theme.

Theme changes should:

* apply immediately
* not require a page refresh
* persist to Supabase
* work on mobile and desktop

Use CSS variables instead of hardcoding colors.

Example:

```css
--background
--surface
--surface-soft
--text
--muted-text
--border
--accent
--accent-hover
--accent-contrast
```

Accent colors should affect:

* primary buttons
* active navigation
* selected states
* highlights
* links
* interactive controls

Do not hardcode purple throughout the application.

---

# 10. Sayen Branding

Brand identity should be simple and recognizable.

Primary wordmark:

```text
sayen
```

Tagline:

```text
a little space to share.
```

Use lowercase branding where appropriate.

The visual identity should communicate:

**small + personal + shared + calm**

Typography should be modern and highly readable.

Use a clean sans-serif font with a little personality if appropriate.

Avoid overly formal corporate typography.

---

# 11. Overall Layout

The app should be **mobile-first**.

Most usage will happen on phones.

Design the mobile experience first rather than designing desktop and squeezing it down.

Support:

* mobile
* tablet
* desktop

The layout should naturally expand on larger screens.

Do not simply stretch mobile cards across the entire desktop viewport.

Use reasonable max-width containers.

---

# 12. Mobile Navigation

Use a bottom navigation bar on mobile:

```text
Home     Our Space     Me
```

The navigation should:

* remain easy to reach
* have large touch targets
* show active state
* use the current accent color
* avoid excessive height

Feature pages can be reached from Home and Our Space.

On desktop, the navigation can adapt into a top or side navigation if that creates a better experience.

---

# 13. Home Page

Home should be the heart of Sayen.

Example structure:

```text
sayen

[avatar] Roxanne
🇵🇭 10:30 AM

[avatar] User 2
🇦🇪 6:30 PM

"thinking of you ❤️"

438 days together

--------------------------------

Daily Check-In
How are you feeling today?

[ Check in ]

--------------------------------

Memories
A small preview of your shared memories

[ View memories ]

--------------------------------

Open When
A little something for later

[ Open when ]

--------------------------------

Play
Something fun for the two of you

[ Play ]
```

The actual layout can improve on this.

Home should feel personal, not like a dashboard.

Use cards and sections with strong visual hierarchy.

Show:

* both names
* avatars
* both local times
* shared status/message
* relationship duration if configured
* important upcoming date
* feature shortcuts

Do not overload the Home page.

---

# 14. Daily Check-In

Create a dedicated `/check-in` page.

Fields:

### Mood

```text
Great
Good
Okay
Not great
Rough
```

### What's on your mind?

Free text field.

### What do you need?

```text
Talk
Reassurance
Distraction
Attention
Space
```

Save:

```text
space_id
user_id
mood
message
need
created_at
```

Use the existing `daily_checkins` table.

The other person should be able to view the check-in.

Design this as a comfortable, low-pressure interaction.

Do not make it feel like a clinical mood tracker.

---

# 15. Memories

Use the existing `memories` table.

A memory contains:

```text
title
caption
location
date
image_url
user_id
space_id
created_at
```

Users should be able to:

* view memories
* create memories
* upload a photo
* add a title
* add caption
* add location
* choose a date

Display memories as:

* mobile-friendly cards
* gallery
* timeline where appropriate

Use Supabase Storage for actual uploaded images.

Images should:

* have rounded corners
* maintain good aspect ratios
* load responsively
* have useful alt text

Avoid making every card the same generic rectangle if the gallery can look more natural.

---

# 16. Open When

Use the existing `open_when_letters` table.

Examples:

```text
Open when you miss me
Open when you're having a bad day
Open when you can't sleep
Open when you need reassurance
```

Initially support text letters only.

Structure the code so it can later support:

* photos
* voice notes
* videos
* scheduled unlock dates

Each letter belongs to the shared Space and has an author.

Opening a letter should feel like opening a small personal message, not opening a database record.

---

# 17. Our Space

Create `/space`.

This page contains:

```text
Important Dates
Shared Goals
Space Settings
```

## Important Dates

Use existing:

```text
important_dates
```

Support:

* Birthday
* Anniversary
* First met
* First date
* Next visit
* custom dates

Allow:

* add
* edit
* delete

Fields:

```text
title
event_date
description
```

Display upcoming dates clearly.

---

# 18. Shared Goals

Use:

```text
shared_goals
```

Examples:

```text
Places to visit
Movies to watch
Things to do
Things to buy
Future plans
```

Support:

* add
* edit
* delete
* mark complete

Keep this lightweight.

It should feel like a shared list rather than a project-management tool.

---

# 19. Space Settings

Allow users to change:

* Space name
* Space theme
* Space accent color

Display the two members.

Do NOT add:

* invite members
* remove other users
* groups
* join space
* create another Space

Those may be future features.

---

# 20. Me / Personal Settings

Create `/settings`.

Include:

```text
Profile

Display name
Profile photo
Timezone

Appearance

Light
Dark
System

Accent color

Pink
Purple
Blue
Green
Orange

Log out
```

Personal theme settings should not change the shared Space theme.

---

# 21. Play

Create `/play`.

Use the existing:

```text
games
game_answers
```

Architecture should support:

```text
Would You Rather
This or That
Daily Question
Guess My Answer
Trivia
```

Basic interaction:

```text
Question
 ↓
User answers
 ↓
Other user answers
 ↓
Reveal answers
```

Keep the architecture extensible so new game types can be added without rewriting the entire feature.

Do not overbuild games initially.

---

# 22. Components

Do NOT put the entire application into `App.jsx`.

Create reusable components such as:

```text
Button
Input
Textarea
Card
Modal
Avatar
ThemeSelector
AccentSelector
BottomNavigation
Navbar
LoadingState
EmptyState
ErrorMessage
FeatureCard
MemberCard
```

Organize features logically.

Suggested structure:

```text
src/
├── components/
│   ├── Button.jsx
│   ├── Card.jsx
│   ├── Avatar.jsx
│   ├── Modal.jsx
│   ├── BottomNavigation.jsx
│   └── ...
│
├── pages/
│   ├── Login.jsx
│   ├── Home.jsx
│   ├── Space.jsx
│   ├── CheckIn.jsx
│   ├── Memories.jsx
│   ├── OpenWhen.jsx
│   ├── Play.jsx
│   └── Settings.jsx
│
├── features/
│   ├── auth/
│   ├── profile/
│   ├── space/
│   ├── checkins/
│   ├── memories/
│   ├── openWhen/
│   ├── games/
│   └── goals/
│
├── lib/
│   ├── auth.js
│   ├── timezone.js
│   └── theme.js
│
├── supabaseClient.js
├── App.jsx
└── main.jsx
```

Adapt the structure if the existing project already has a good organization.

Do not create unnecessary abstraction.

---

# 23. Loading States

Every Supabase request should have an appropriate loading state.

Examples:

```text
Loading your space...
Loading memories...
Loading...
```

Do not show broken layouts while data is loading.

Use skeletons where appropriate.

---

# 24. Empty States

Every feature needs a useful empty state.

Examples:

```text
No memories yet.
Start saving little moments here.

[ Add a memory ]
```

or:

```text
No important dates yet.

[ Add a date ]
```

Keep empty states warm and simple.

---

# 25. Error Handling

Handle:

* invalid login
* expired session
* Supabase errors
* network failures
* missing profile
* missing Space
* missing membership
* unauthorized access
* failed uploads
* failed updates
* failed deletes

Use friendly messages.

Do not expose raw database errors to users unless necessary.

---

# 26. Security

Security is important.

RLS is already enabled in Supabase.

Never rely only on frontend authorization.

Do not:

* expose service-role keys
* hardcode private credentials
* hardcode user IDs for authorization
* hardcode Space IDs
* allow users to access another Space by changing a URL
* assume that hiding UI elements is security

Use Supabase RLS to enforce access.

The frontend should only query the authenticated user's accessible data.

---

# 27. Responsive Design

Mobile first.

Target:

```text
320px+
375px
390px
430px
768px
1024px
1280px+
```

Ensure:

* no horizontal scrolling
* no overflowing buttons
* no clipped text
* touch-friendly controls
* comfortable form fields
* responsive images
* responsive cards
* readable typography
* appropriate spacing
* accessible focus states

Do not use tiny text or tiny touch targets.

---

# 28. Accessibility

Use:

* semantic HTML
* proper labels
* accessible buttons
* keyboard navigation
* visible focus states
* alt text
* good color contrast
* sufficient touch target sizes

Do not rely on color alone to communicate state.

---

# 29. Design System

Create a consistent visual system.

Use:

```css
--background
--surface
--surface-soft
--text
--muted-text
--border
--accent
--accent-hover
--accent-contrast
--radius-sm
--radius-md
--radius-lg
--shadow-soft
```

Use consistent spacing and typography throughout the app.

Cards should have subtle borders and/or soft shadows.

Use rounded corners, but don't make every element excessively rounded.

Buttons should feel tactile but not overly animated.

Animations should be subtle and purposeful.

Respect reduced-motion preferences.

---

# 30. Data Loading Architecture

When authenticated:

```text
getSession()
 ↓
currentUser
 ↓
fetch profile
 ↓
fetch space_members where user_id = currentUser.id
 ↓
get space_id
 ↓
fetch Space
 ↓
fetch both members
 ↓
store shared app context
```

Create a reusable context/hook if useful, such as:

```text
useAuth()
useSpace()
useProfile()
useTheme()
```

Do not duplicate the same Supabase queries across every page.

---

# 31. Important Implementation Rule

Do not build all features at once.

Build incrementally.

### Phase 1

Implement and test:

```text
Login
 ↓
Supabase Auth
 ↓
Session
 ↓
Profile
 ↓
Shared Space
 ↓
Both members
 ↓
Home
```

### Phase 2

Implement:

```text
Both local times
Personal theme
Personal accent
Space theme
Space accent
Theme priority
```

### Phase 3

Polish:

```text
Home
Mobile navigation
Settings
Responsive desktop layout
```

### Phase 4

Build:

```text
Daily Check-In
Memories
Open When
Important Dates
Shared Goals
Play
```

### Phase 5

Final pass:

```text
Loading states
Empty states
Error states
Accessibility
Responsive testing
RLS testing
Visual polish
```

---

# 32. First Task — Do This Now

Do NOT immediately build every page.

Start with:

```text
/login
```

Then make the real authentication flow work.

After login:

```text
current user
 ↓
profile
 ↓
shared Space
 ↓
both members
 ↓
/home
```

The first Home implementation only needs:

* Sayen branding
* both users
* avatars
* both local times
* a simple shared message
* basic feature cards
* mobile bottom navigation

Use real Supabase data.

Do not use fake users or fake Space IDs.

Once this foundation works, continue feature-by-feature.

---

# 33. Code Quality

Write clean, readable JavaScript.

Prefer simple solutions.

Avoid unnecessary libraries.

Do not add dependencies unless there is a clear reason.

Do not rewrite working Supabase configuration.

Do not delete existing schema.

Do not create duplicate tables.

Do not create fake API layers when Supabase can be used directly.

Keep UI, data fetching, and reusable components reasonably separated.

---

# 34. Final Design Goal

When opening Sayen, the user should immediately feel:

> “This is our little space.”

It should feel personal without being cluttered.

It should feel modern without looking like a SaaS dashboard.

It should feel playful without becoming childish.

It should feel private without constantly reminding the user about security.

The most important qualities are:

**simple + warm + personal + polished + mobile-first.**