#include <stdio.h>
#include <stdlib.h>


 
static struct ListNode* removeNthFromEnd(struct ListNode* head, int n)
{
    if (n == 0) {
        return NULL;
    }

    struct ListNode *p, *prev, dummy;
    dummy.next = head;
    p = prev = &dummy;
    while (n-- > 0) {
        p = p->next;
    }

    while (p->next != NULL) {
        p = p->next;
        prev = prev->next;
    }

    struct ListNode *tmp = prev->next;
    prev->next = tmp->next;
    if (tmp == head) {
        head = tmp->next;
    }

    return head;
}
