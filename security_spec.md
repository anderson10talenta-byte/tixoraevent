# Security Specification - Tixora Event Ticketing & Gate Check-In

## 1. Data Invariants
1. **User Identity Invariant**: A user document at `/users/{userId}` can only be read or written by the authentic user with matching `request.auth.uid`, or by the Super Admin (`anderson10.talenta@gmail.com`).
2. **Super Admin Privilege Gate**: Administrative privileges are strictly bound to `anderson10.talenta@gmail.com` and records in `/admins/{adminId}`. Non-admins cannot elevate their own roles.
3. **Ticket Integrity**: Attendee tickets at `/tickets/{ticketId}` cannot be falsified; token hashes must be unique and check-in transitions are atomic (a used ticket cannot be re-used).
4. **Gate Staff Authorization**: Organizers grant gate staff permissions via email in `/staffAssignments/{assignmentId}`. An attendee or organizer can only scan tickets if authorized for that event or if they are Super Admin.
5. **Event Ownership**: Only the event creator or Super Admin can edit or delete an event. Public users can only read published events.

## 2. Dirty Dozen Threat Vectors & Mitigations
1. **Self-Promote to Super Admin**: Attacker attempts to write `isSuperAdmin: true` to their user profile. *Mitigation: Rules restrict admin lookup to email whitelist and `/admins/` collection.*
2. **Read Other Attendees' Tickets**: Attacker queries tickets belonging to other user IDs. *Mitigation: `allow list: if resource.data.attendeeUserId == request.auth.uid || isSuperAdmin()`.*
3. **Ghost Event Creation**: Attacker attempts to forge `createdBy` with another user's UID. *Mitigation: Invariant check `incoming().createdBy == request.auth.uid`.*
4. **Unassigned Gate Check-In**: User attempts to check in tickets for an event where they are not assigned staff. *Mitigation: Explicit verification against `/staffAssignments/` or event ownership.*
5. **Replay Check-In (Double Entry)**: Check-in request on an already 'used' ticket. *Mitigation: Status transition check blocking update if `existing().status == 'used'` unless administrative override.*
6. **Huge Payload Denial of Wallet**: Malicious payload with 5MB strings. *Mitigation: Strict `size() <= limit` checks on every string.*
7. **Document ID Poisoning**: Injected slash or regex characters in document ID. *Mitigation: `isValidId()` enforcing `[a-zA-Z0-9_\-]+` with length <= 128.*
8. **Shadow Field Injection**: Adding unknown privileged properties like `vipPass: true`. *Mitigation: `affectedKeys().hasOnly(...)`.*
9. **Tampering with Ticket Status Directly**: Attendee attempts to reset their ticket from 'used' to 'valid'. *Mitigation: Only assigned staff or Super Admin can update ticket check-in fields.*
10. **Forging Order Total**: Creating an order with `totalMinor: -1000`. *Mitigation: Numeric boundary verification.*
11. **Client Delegation Leak**: Allowing blanket read without evaluating resource ownership. *Mitigation: All list rules enforce `resource.data` ownership.*
12. **Unauthenticated Access**: Guest accessing attendee QR tokens or staff rosters. *Mitigation: Default-deny catch-all with strict `isSignedIn()` checks.*
