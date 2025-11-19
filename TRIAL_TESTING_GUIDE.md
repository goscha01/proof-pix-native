# Trial Notification Testing Guide

This guide explains how to test the trial notification messages that appear at different days during the 30-day free trial.

## Quick Start

1. **Open the Settings screen** in your app
2. **Scroll to the bottom** - you'll see a yellow "🧪 Trial Test Tools" section (only visible in development mode)
3. **Tap any test button** to set the trial to that day
4. **Restart the app** or **send app to background and back** to trigger the notification check

## Testing Methods

### Method 1: Using the Test UI (Easiest)

1. Go to **Settings** screen
2. Scroll to the **Trial Test Tools** section at the bottom
3. Tap a test button (e.g., "Day 0 (Welcome)")
4. You'll see an alert confirming the trial was set
5. **Close and reopen the app** (or send to background and foreground)
6. The notification modal should appear automatically

### Method 2: Using JavaScript Console

You can also test programmatically in the React Native debugger or console:

```javascript
// Import the test utilities
import * as TrialTestUtils from './src/utils/trialTestUtils';

// Set trial to Day 0 (Welcome message)
await TrialTestUtils.testDay0('business');

// Set trial to Day 7-10 (Engagement nudge)
await TrialTestUtils.testDay7_10('business');

// Set trial to Day 15 (Mid-trial check-in)
await TrialTestUtils.testDay15('business');

// Set trial to Day 22-24 (Early reminder)
await TrialTestUtils.testDay22_24('business');

// Set trial to Day 27-28 (Last chance)
await TrialTestUtils.testDay27_28('business');

// Set trial to Day 30 (Expired)
await TrialTestUtils.testDay30('business');

// Clear trial completely
await TrialTestUtils.clearTrial();

// Check current trial status
const info = await TrialTestUtils.getCurrentTrialInfo();
console.log(info);
```

### Method 3: Direct AsyncStorage Manipulation

If you need more control, you can directly modify AsyncStorage:

```javascript
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set trial to 5 days remaining
const trialInfo = {
  active: true,
  used: true,
  startDate: new Date(Date.now() - 25 * 24 * 60 * 60 * 1000).toISOString(),
  endDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  plan: 'business',
};
await AsyncStorage.setItem('@user_trial_info', JSON.stringify(trialInfo));

// Reset notifications to see them again
await AsyncStorage.removeItem('@trial_notifications_shown');
```

## Test Scenarios

### Day 0 - Welcome Message
- **Expected**: Welcome message with trial info
- **Test**: Tap "Day 0 (Welcome)" button
- **When shown**: Days 28-30 remaining

### Day 7-10 - Engagement Nudge
- **Expected**: Random tip about features (bulk delete, watermarks, or projects)
- **Test**: Tap "Day 7-10" button
- **When shown**: Days 20-23 remaining

### Day 15 - Mid-Trial Check-in
- **Expected**: "Halfway through your trial" message
- **Test**: Tap "Day 15" button
- **When shown**: Days 14-16 remaining

### Day 22-24 - Early Reminder
- **Expected**: "1 week left" message with upgrade button
- **Test**: Tap "Day 22-24" button
- **When shown**: Days 6-8 remaining

### Day 27-28 - Last Chance
- **Expected**: Urgent "Last chance" message with red upgrade button
- **Test**: Tap "Day 27-28" button
- **When shown**: Days 2-3 remaining

### Day 30 - Expiration
- **Expected**: "Trial ended" message with upgrade option
- **Test**: Tap "Day 30 (Expired)" button
- **When shown**: When trial has expired

## Important Notes

1. **Notifications are shown once per type** - Each notification type is only shown once. To test again, you need to:
   - Use the "Clear Trial" button, then set a new trial
   - Or manually reset notifications: `await AsyncStorage.removeItem('@trial_notifications_shown')`

2. **App restart required** - After setting a trial day, you need to:
   - Close and reopen the app, OR
   - Send app to background and bring it to foreground
   - This triggers the notification check

3. **Development mode only** - The test UI is only visible when `__DEV__` is true (development builds)

4. **Notification timing** - Notifications are checked:
   - On app startup (after 2 second delay)
   - When app comes to foreground
   - When Settings screen loads (for trial info display)

## Troubleshooting

### Notification not showing?
- Make sure you restarted the app or sent it to background/foreground
- Check if notification was already shown: `await AsyncStorage.getItem('@trial_notifications_shown')`
- Verify trial is active: `await AsyncStorage.getItem('@user_trial_info')`

### Want to test the same notification again?
- Clear notifications: `await AsyncStorage.removeItem('@trial_notifications_shown')`
- Or use the "Clear Trial" button, then set trial again

### Testing different plan tiers?
- All test functions accept a `plan` parameter: `testDay0('pro')`, `testDay0('business')`, etc.

## Testing Checklist

- [ ] Day 0 welcome message appears
- [ ] Day 7-10 engagement message appears (random tip)
- [ ] Day 15 check-in message appears
- [ ] Day 22-24 early reminder appears with upgrade button
- [ ] Day 27-28 last chance appears with urgent styling
- [ ] Day 30 expiration message appears
- [ ] Upgrade button navigates to Settings
- [ ] "Maybe Later" / "Got It" buttons close modal
- [ ] Notifications don't show twice
- [ ] Trial status updates correctly in Settings screen


