#include <stdio.h>
#include <stdlib.h>



static struct ListNode* swapPairs(struct ListNode* head)
{
    if (head == NULL) {
        return NULL;
    }
    struct ListNode dummy;
    dummy.next = head;
    struct ListNode *prev = &dummy;
    struct ListNode *p = dummy.next;

    while (p != NULL && p->next != NULL) {
        struct ListNode *q = p->next;
        /* deletion */
        p->next = q->next;
        /* insertion */
        q->next = p;
        prev->next = q;
        /* iteration */
        prev = p;
        p = p->next;
    }
    return dummy.next;
}
