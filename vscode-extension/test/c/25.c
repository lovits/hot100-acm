#include <stdio.h>
#include <stdlib.h>



static struct ListNode* reverseKGroup(struct ListNode* head, int k)
{
    int len = 0;
    struct ListNode dummy;
    struct ListNode *prev = &dummy;
    dummy.next = head;
    for (; head != NULL; head = head->next) {
        if (++len % k == 0) {
            /* p always the original first one */
            struct ListNode *p = prev->next;
            /* loop condition implicits the final state */
            while (prev->next != head) {
                /* the new segment head */
                struct ListNode *q = p->next;
                /* deletion */
                p->next = q->next;
                /* insertion */
                q->next = prev->next;
                prev->next = q;
            }
            /* For iteration */
            prev = p;
            head = p;
        }
    }
    return dummy.next;
}
