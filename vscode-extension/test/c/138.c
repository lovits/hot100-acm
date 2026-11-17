#include <stdio.h>
#include <stdlib.h>



static struct Node *copyRandomList(struct Node *head)
{
    struct Node *p, *q;
    /* insert interleavingly */
    for (p = head; p != NULL; p = q->next) {
        q = malloc(sizeof(*q));
        q->val = p->val;
        q->next = p->next;
        p->next = q;
    }

    /* clone random pointer */
    for (p = head; p != NULL; p = q->next) {
        q = p->next;
        q->random = p->random != NULL ? p->random->next : NULL;
    }

    struct Node dummy;
    struct Node *prev = &dummy;
    prev->next = head;
    /* separate q list */
    for (p = head; p != NULL; p = q->next) {
        q = p->next;
        /* restore p->next */
        p->next = q->next;
        prev->next = q;
        prev = q;
    }
    /* q->next = NULL */

    return dummy.next;
}
