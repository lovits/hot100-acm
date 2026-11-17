#include <stdio.h>
#include <stdlib.h>
#include <stdbool.h>



static struct ListNode *getIntersectionNode(struct ListNode *headA, struct ListNode *headB)
{
    if (headA == NULL || headB == NULL) {
        return NULL;
    }

    struct ListNode *p;
    for (p = headA; p->next != NULL; p = p->next) {}
    p->next = headB;

    struct ListNode *slow = headA, *fast = headA;
    while (fast != NULL && fast->next != NULL) {
        slow = slow->next;
        fast = fast->next->next;
        if (slow == fast) {
            slow = headA;
            while (slow != fast) {
                slow = slow->next;
                fast = fast->next;
            }
            p->next = NULL;
            return slow;
        }
    }

    p->next = NULL;
    return NULL;
}
