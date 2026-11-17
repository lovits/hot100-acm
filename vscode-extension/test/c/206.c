#include <stdio.h>
#include <stdlib.h>




static struct ListNode *recursive(struct ListNode *prev, struct ListNode *p)
{
    if (p == NULL) {
        return prev;
    }

    struct ListNode *q = p->next;
    p->next = prev;
    return recursive(p, q);
}

struct ListNode *reverseList(struct ListNode *head)
{
    return recursive(NULL, head);
}


#if 0
/* Iteration */
struct ListNode *reverseList(struct ListNode *head)
{
    struct ListNode *prev = NULL;
    struct ListNode *p = head;
    while (p != NULL) {
        /* prev <- p <- q */
        struct ListNode *q = p->next;
        p->next = prev;
        /* step */
        prev = p;
        p = q;
    }

    return prev;
}
#endif
