#include <stdio.h>
#include <stdlib.h>
#include <string.h>



static struct TreeNode *partition(struct TreeNode *node)
{
    if (node == NULL) {
        return NULL;
    }

    if (node->right == NULL && node->left == NULL) {
        return node;
    }

    struct TreeNode *right_last = partition(node->right);
    struct TreeNode *left_last = partition(node->left);

    if (left_last != NULL) {
        left_last->right = node->right;
        node->right = node->left;
        node->left = NULL;
    }

    return right_last != NULL ? right_last : left_last;
}

static void flatten(struct TreeNode *root)
{
    partition(root);
}
