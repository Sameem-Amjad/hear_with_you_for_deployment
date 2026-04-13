Mobile side screens flow
- Home Screen: create story button on click of that screen open take user prompt and generate the story
- Home Screen: Choose templates => fantasy, adventure, science fiction, mystery, historical, romantic tales, family stories, future vision, fairy tales (these will be added from admin side and but show on mobile side with pagination and user click on that and generate the story)
- Home Screen: Continue listening a single voice shown with progress.
- Home Screen: Featured Stories are those voice stories that are pinned or favorite by user and there is see all that take it to another screen to show all with pagination

- Voice Managment Screen: there is two option one record voice and upload voice, upload voice will be upload through presigned url and meta data send to the server and server save the metadata and record video first record by mobile and then upload the presigned url and then meta data save tp the server, in both of these scenario sample audio will be clone by eleven labs
- Voice Managment Screen: There is Your voices section that show the clone sample of audio given by the eleven labs with pagination

- Library Screen: Your voices section that show the clone sample of audio given by the eleven labs with pagination
- Library Screen: Recent Stories generated through eleven labs with combination of favorite and unfavourite with pagination

- Favourite Screen: Show those stories that are favourite by user with pagination

- Add feedback and rate us.
- Delete 

Subscription Plan:
- added from the admin side and on mobile side is shown no price managment from admin side
- mobile side buy subscription using in app purchases and the subscription plan save in the database against that user 
- base on subscription plan user allow to create stories, sample voice cloning and stuff like that (you can make of your own Basic(free), Premium, Platinum)
- according to this he is allowed to use the app

Admin Side:
- Dashboard: Total user count , active subscription count, monthly revenue count, stories created so far count and there percentage from previous month increase or decrease
- Dashboard: Revenue Overview graph for last seven days, 30 days, 90 days
- Dashboard: User Growth: New Users Count and Active User count of total Users
- Dashboard: Recent Activity of user: Profile pic, name, activity name, date of activity , how much time passed in min or hour, isActive or not 

- User: search user, filter user base on free, premium or platinum or active and inactive
- User: user list contain profile pic, name , mail, plan name, voices count added so far, stories count so far, status active/inactive, action buttons( disable user or delete user) with pagination

- Stories: Search story, filter story on base of template, total stories count, total plays of story count, stories today generated 
- Stories: Recent Stories with pagination: (Story name, user name, voice name, duration created date, how many time it plays)

- Subscriptions: search subscription plan with filter, total monthly revenue and percentage compared to previous month, same with active subscription and percentage compared to previous month
- Subscriptions: Plan Distribution section showing Basic, Premium, Platinum with their prices and total number of user have those plan out of total user 
- Subsctiptions: Recent Transaction : Profile pic, user name, plan name and plan amount , date of buy

Settings: Api Settings Section: Open Api Key added, Eleven Labs Key added
Setting: Subscription plan Prices added here


- Admin Creation Api with profile pic, name and mail